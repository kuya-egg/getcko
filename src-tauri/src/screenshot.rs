//! Screenshot preparation and coordinate conversion for vision-model input.

use crate::engine::RgbImage;
use crate::model::{MonitorFrame, Rect, ScreenElement};
use crate::platform::ScreenCapture;
use image::GenericImageView;
use image::imageops::FilterType;

/// Longest side of the image given to the model.
pub const MAX_SIDE: u32 = 1024;

/// A capture scaled for the model, and how to map between its pixels and the desktop.
#[derive(Clone, PartialEq)]
pub struct Prepared {
    /// RGB image supplied to the model.
    pub image: RgbImage,
    /// Physical desktop position of the capture's top-left pixel.
    pub origin: (f64, f64),
    /// Display holding the capture (where the overlay draws).
    pub monitor: MonitorFrame,
    /// Image pixels per physical desktop pixel.
    pub scale: f64,
    /// The capture at full resolution, unmarked, for [`close_up`].
    pub source: image::RgbaImage,
}

impl std::fmt::Debug for Prepared {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Prepared")
            .field("image", &self.image)
            .field("origin", &self.origin)
            .field("monitor", &self.monitor)
            .field("scale", &self.scale)
            .field("source", &self.source.dimensions())
            .finish()
    }
}

/// Side of a [`close_up`] in capture pixels: a few menu-bar icons around the point on
/// a Retina display.
const CLOSE_UP_SIDE: u32 = 320;

/// The capture around physical desktop point (`x`, `y`) at full resolution, the point
/// ringed in yellow: what a tier-3 guess shows, for the answer pass. In the downscaled
/// screenshot a menu-bar icon is a few pixels wide; told only that the pointer was a
/// guess, the answer pass said "I don't know" to 4 of 4 menu-bar questions, and named
/// the icon in 4 of 5 with this close-up (the ring keeps a neighbouring icon from being
/// named instead). `None` for an empty capture.
#[must_use]
pub fn close_up(prepared: &Prepared, x: f64, y: f64) -> Option<RgbImage> {
    let (width, height) = prepared.source.dimensions();
    let side = CLOSE_UP_SIDE.min(width).min(height);
    if side == 0 {
        return None;
    }
    let at = |value: f64, origin: f64, size: u32| {
        (value - origin).round().clamp(0.0, f64::from(size - 1)) as u32
    };
    let (px, py) = (
        at(x, prepared.origin.0, width),
        at(y, prepared.origin.1, height),
    );
    let left = px.saturating_sub(side / 2).min(width - side);
    let top = py.saturating_sub(side / 2).min(height - side);
    let crop = image::imageops::crop_imm(&prepared.source, left, top, side, side);
    let mut image = RgbImage {
        width: side,
        height: side,
        rgb: crop
            .pixels()
            .flat_map(|(_, _, pixel)| [pixel[0], pixel[1], pixel[2]])
            .collect(),
    };
    let (cx, cy) = (f64::from(px - left), f64::from(py - top));
    let radius = f64::from(side) / 10.0;
    for yy in 0..side {
        for xx in 0..side {
            let distance = (f64::from(xx) - cx).hypot(f64::from(yy) - cy);
            if (distance - radius).abs() < 2.5 {
                set_pixel(&mut image, xx, yy, [255, 200, 0]);
            }
        }
    }
    Some(image)
}

/// GBNF for a tier-3 reply: `[y, x]` normalized to 0-1000 (Gemma's pointing
/// format), or `none`.
pub const POINT_GRAMMAR: &str =
    "root ::= \"[\" num \", \" num \"]\" | \"none\"\nnum ::= [0-9] [0-9]? [0-9]? [0-9]?";

/// Downscales the capture without upscaling, converts RGBA to RGB, and optionally draws element marks.
#[must_use]
pub fn prepare(capture: ScreenCapture, marks: Option<&[ScreenElement]>) -> Prepared {
    let (width, height) = if capture.width == 0
        || capture.height == 0
        || capture.width.max(capture.height) <= MAX_SIDE
    {
        (capture.width, capture.height)
    } else {
        // Rounded dimensions preserve the aspect ratio while keeping the long side at MAX_SIDE.
        let scale = f64::from(MAX_SIDE) / f64::from(capture.width.max(capture.height));
        let width = (f64::from(capture.width) * scale)
            .round()
            .clamp(1.0, f64::from(MAX_SIDE)) as u32;
        let height = (f64::from(capture.height) * scale)
            .round()
            .clamp(1.0, f64::from(MAX_SIDE)) as u32;
        (width, height)
    };
    let source = image::RgbaImage::from_raw(capture.width, capture.height, capture.rgba)
        .unwrap_or_else(|| image::RgbaImage::new(capture.width, capture.height));
    let scaled = ((width, height) != (capture.width, capture.height) && width > 0 && height > 0)
        .then(|| image::imageops::resize(&source, width, height, FilterType::Triangle));
    let rgba = scaled.as_ref().unwrap_or(&source);
    let mut rgb = image::RgbImage::new(width, height);
    for (x, y, pixel) in rgb.enumerate_pixels_mut() {
        let source = rgba.get_pixel(x, y);
        *pixel = image::Rgb([source[0], source[1], source[2]]);
    }
    let scale = if capture.width == 0 {
        1.0
    } else {
        f64::from(width) / f64::from(capture.width)
    };
    let mut image = RgbImage {
        width,
        height,
        rgb: rgb.into_raw(),
    };
    if let Some(elements) = marks {
        for element in elements {
            draw_mark(
                &mut image,
                (capture.x, capture.y),
                scale,
                &element.bounds,
                &element.id,
            );
        }
    }
    Prepared {
        image,
        origin: (f64::from(capture.x), f64::from(capture.y)),
        monitor: capture.monitor,
        scale,
        source,
    }
}

/// Converts a physical desktop rectangle to model-image pixels; the result may extend beyond the image.
#[must_use]
pub fn to_image(prepared: &Prepared, rect: &Rect) -> Rect {
    Rect {
        x: (rect.x - prepared.origin.0) * prepared.scale,
        y: (rect.y - prepared.origin.1) * prepared.scale,
        width: rect.width * prepared.scale,
        height: rect.height * prepared.scale,
    }
}

/// Converts an image-pixel point to physical desktop coordinates.
#[must_use]
pub fn to_physical(prepared: &Prepared, x: f64, y: f64) -> (f64, f64) {
    if prepared.scale == 0.0 {
        return (prepared.origin.0, prepared.origin.1);
    }
    (
        prepared.origin.0 + x / prepared.scale,
        prepared.origin.1 + y / prepared.scale,
    )
}

/// Largest coordinate in the model's point format (Gemma: 0-1000 on each axis).
const POINT_SCALE: f64 = 1000.0;

/// Parses a `[y, x]` reply normalized to 0-1000 (Gemma's pointing format) into
/// image pixels. Rejects malformed or out-of-range replies, including `none`.
#[must_use]
pub fn parse_point(prepared: &Prepared, reply: &str) -> Option<(f64, f64)> {
    let inner = reply.trim().strip_prefix('[')?.strip_suffix(']')?;
    let (y, x) = inner.split_once(',')?;
    let axis = |text: &str| {
        let text = text.trim();
        if text.is_empty() || text.len() > 4 || !text.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        let value = f64::from(text.parse::<u16>().ok()?);
        (value <= POINT_SCALE).then_some(value / POINT_SCALE)
    };
    let (y, x) = (axis(y)?, axis(x)?);
    Some((
        x * f64::from(prepared.image.width),
        y * f64::from(prepared.image.height),
    ))
}

fn draw_mark(image: &mut RgbImage, origin: (i32, i32), scale: f64, bounds: &Rect, id: &str) {
    if image.width == 0 || image.height == 0 || scale <= 0.0 {
        return;
    }
    let left = (bounds.x - f64::from(origin.0)) * scale;
    let top = (bounds.y - f64::from(origin.1)) * scale;
    let right = (bounds.x + bounds.width - f64::from(origin.0)) * scale;
    let bottom = (bounds.y + bounds.height - f64::from(origin.1)) * scale;
    if right <= 0.0
        || bottom <= 0.0
        || left >= f64::from(image.width)
        || top >= f64::from(image.height)
    {
        return;
    }
    let x0 = left.floor().clamp(0.0, f64::from(image.width - 1)) as u32;
    let y0 = top.floor().clamp(0.0, f64::from(image.height - 1)) as u32;
    let x1 = right.ceil().clamp(1.0, f64::from(image.width)) as u32;
    let y1 = bottom.ceil().clamp(1.0, f64::from(image.height)) as u32;
    const COLOR: [u8; 3] = [240, 0, 160];
    for yy in y0..y1.min(y0.saturating_add(2)) {
        for xx in x0..x1 {
            set_pixel(image, xx, yy, COLOR);
        }
    }
    for yy in y1.saturating_sub(2).max(y0)..y1 {
        for xx in x0..x1 {
            set_pixel(image, xx, yy, COLOR);
        }
    }
    for xx in x0..x1.min(x0.saturating_add(2)) {
        for yy in y0..y1 {
            set_pixel(image, xx, yy, COLOR);
        }
    }
    for xx in x1.saturating_sub(2).max(x0)..x1 {
        for yy in y0..y1 {
            set_pixel(image, xx, yy, COLOR);
        }
    }
    draw_tag(image, x0, y0, id);
}

fn draw_tag(image: &mut RgbImage, x: u32, y: u32, id: &str) {
    let glyphs: Vec<_> = id.chars().filter_map(glyph).collect();
    if glyphs.is_empty() {
        return;
    }
    const FACTOR: u32 = 2;
    const PAD: u32 = 2;
    let tag_h = 7 * FACTOR + PAD * 2;
    let tag_w = (glyphs.len() as u32 * 6 - 1) * FACTOR + PAD * 2;
    let end_x = x.saturating_add(tag_w).min(image.width);
    let end_y = y.saturating_add(tag_h).min(image.height);
    for yy in y..end_y {
        for xx in x..end_x {
            set_pixel(image, xx, yy, [240, 0, 160]);
        }
    }
    let mut cursor = x.saturating_add(PAD);
    for glyph in glyphs {
        for (gy, row) in glyph.iter().enumerate() {
            for gx in 0..5u32 {
                if row & (1 << (4 - gx)) != 0 {
                    for dy in 0..FACTOR {
                        for dx in 0..FACTOR {
                            let px = cursor + gx * FACTOR + dx;
                            let py = y + PAD + gy as u32 * FACTOR + dy;
                            if px < end_x && py < end_y {
                                set_pixel(image, px, py, [255, 255, 255]);
                            }
                        }
                    }
                }
            }
        }
        cursor += 6 * FACTOR;
        if cursor >= end_x {
            break;
        }
    }
}

fn set_pixel(image: &mut RgbImage, x: u32, y: u32, color: [u8; 3]) {
    let index = ((y as usize * image.width as usize) + x as usize) * 3;
    image.rgb[index..index + 3].copy_from_slice(&color);
}

fn glyph(ch: char) -> Option<[u8; 7]> {
    Some(match ch {
        'e' => [0, 0, 14, 17, 31, 16, 15],
        't' => [8, 8, 30, 8, 8, 9, 6],
        '0' => [14, 17, 19, 21, 25, 17, 14],
        '1' => [4, 12, 4, 4, 4, 4, 14],
        '2' => [14, 17, 1, 2, 4, 8, 31],
        '3' => [30, 1, 1, 14, 1, 1, 30],
        '4' => [2, 6, 10, 18, 31, 2, 2],
        '5' => [31, 16, 16, 30, 1, 1, 30],
        '6' => [14, 16, 16, 30, 17, 17, 14],
        '7' => [31, 1, 2, 4, 8, 8, 8],
        '8' => [14, 17, 17, 14, 17, 17, 14],
        '9' => [14, 17, 17, 15, 1, 1, 14],
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn capture(
        width: u32,
        height: u32,
        monitor_x: i32,
        monitor_y: i32,
        color: [u8; 4],
    ) -> ScreenCapture {
        ScreenCapture {
            width,
            height,
            rgba: color.repeat((width as usize) * (height as usize)),
            x: monitor_x,
            y: monitor_y,
            monitor: MonitorFrame {
                x: monitor_x,
                y: monitor_y,
                width,
                height,
                scale_factor: 1.0,
            },
        }
    }

    #[test]
    fn close_up_keeps_a_corner_point_inside_at_full_resolution() {
        // A 3600-wide capture whose desktop origin is (100, 50); one red pixel near its
        // top-right corner, where menu-bar icons sit.
        let mut shot = capture(3600, 2338, 100, 50, [0, 0, 0, 255]);
        let (px, py) = (3590_usize, 4_usize);
        let at = (py * 3600 + px) * 4;
        shot.rgba[at..at + 4].copy_from_slice(&[255, 0, 0, 255]);
        let prepared = prepare(shot, None);
        let close = close_up(&prepared, 100.0 + 3590.0, 50.0 + 4.0).expect("close-up");
        assert_eq!((close.width, close.height), (CLOSE_UP_SIDE, CLOSE_UP_SIDE));
        // The crop stops at the right edge: the point is 10 px from the crop's right side.
        let (x, y) = (CLOSE_UP_SIDE - 10, 4);
        let i = ((y * close.width + x) * 3) as usize;
        assert_eq!(&close.rgb[i..i + 3], &[255, 0, 0]);
        let empty = prepare(capture(0, 0, 0, 0, [0, 0, 0, 255]), None);
        assert!(close_up(&empty, 0.0, 0.0).is_none());
    }

    #[test]
    fn scales_large_capture_and_keeps_small_capture_size() {
        let large = prepare(capture(3600, 2338, 0, 0, [0, 0, 0, 255]), None);
        assert_eq!((large.image.width, large.image.height), (1024, 665));
        let small = prepare(capture(800, 600, 0, 0, [0, 0, 0, 255]), None);
        assert_eq!((small.image.width, small.image.height), (800, 600));
    }

    #[test]
    fn converts_rgba_channels_to_rgb() {
        let result = prepare(capture(1, 1, 0, 0, [255, 0, 0, 255]), None);
        assert_eq!(result.image.rgb, [255, 0, 0]);
    }

    #[test]
    fn marks_outline_and_tag_without_coloring_element_centre() {
        let source = || capture(100, 100, 0, 0, [20, 30, 40, 255]);
        let marks = [ScreenElement {
            id: "e12".into(),
            role: "button".into(),
            label: String::new(),
            value: None,
            bounds: Rect {
                x: 10.0,
                y: 10.0,
                width: 80.0,
                height: 80.0,
            },
        }];
        let result = prepare(source(), Some(&marks));
        let pixel =
            |x: usize, y: usize| &result.image.rgb[(y * 100 + x) * 3..(y * 100 + x) * 3 + 3];
        assert_eq!(pixel(50, 50), &[20, 30, 40]);
        assert_eq!(pixel(10, 30), &[240, 0, 160]);
        assert_ne!(pixel(13, 13), &[20, 30, 40]);
        let mut shifted = source();
        shifted.x = 1000;
        let plain: Vec<u8> = shifted
            .rgba
            .as_chunks::<4>()
            .0
            .iter()
            .flat_map(|p| p[..3].iter().copied())
            .collect();
        let outside = [ScreenElement {
            bounds: Rect {
                x: 10.0,
                y: 10.0,
                width: 20.0,
                height: 20.0,
            },
            ..marks[0].clone()
        }];
        assert_eq!(prepare(shifted, Some(&outside)).image.rgb, plain);
    }

    #[test]
    fn coordinate_round_trip_with_negative_monitor_origin() {
        let result = prepare(capture(1600, 900, -1440, 200, [0, 0, 0, 255]), None);
        let physical = Rect {
            x: -1000.0,
            y: 400.0,
            width: 250.0,
            height: 100.0,
        };
        let image_rect = to_image(&result, &physical);
        let point = to_physical(&result, image_rect.x, image_rect.y);
        assert!((point.0 - physical.x).abs() < 1e-9);
        assert!((point.1 - physical.y).abs() < 1e-9);
    }

    #[test]
    fn parses_normalized_y_x_points() {
        let prepared = prepare(capture(200, 100, 0, 0, [0, 0, 0, 255]), None);
        assert_eq!(parse_point(&prepared, "[500, 250]"), Some((50.0, 50.0)));
        assert_eq!(parse_point(&prepared, " [0,1000] "), Some((200.0, 0.0)));
        assert_eq!(parse_point(&prepared, "[1001, 5]"), None);
        assert_eq!(parse_point(&prepared, "[12, 34x]"), None);
        assert_eq!(parse_point(&prepared, "12, 34"), None);
        assert_eq!(parse_point(&prepared, "none"), None);
    }
}
