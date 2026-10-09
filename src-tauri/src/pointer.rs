use crate::model::{MonitorFrame, PointerTarget, Rect, ScreenElement};

pub fn locate(element: &ScreenElement, monitors: &[MonitorFrame]) -> Option<PointerTarget> {
    let (cx, cy) = element.bounds.center();
    let monitor = monitors.iter().copied().find(|m| {
        cx >= f64::from(m.x)
            && cy >= f64::from(m.y)
            && cx < f64::from(m.x) + f64::from(m.width)
            && cy < f64::from(m.y) + f64::from(m.height)
    })?;
    let scale = monitor.scale_factor;
    Some(PointerTarget {
        element_id: element.id.clone(),
        label: element.label.clone(),
        monitor,
        rect: Rect {
            x: (element.bounds.x - f64::from(monitor.x)) / scale,
            y: (element.bounds.y - f64::from(monitor.y)) / scale,
            width: element.bounds.width / scale,
            height: element.bounds.height / scale,
        },
    })
}

pub fn monitors(app: &tauri::AppHandle) -> Vec<MonitorFrame> {
    app.available_monitors()
        .map(|monitors| {
            monitors
                .into_iter()
                .map(|m| {
                    let p = m.position();
                    let s = m.size();
                    MonitorFrame {
                        x: p.x,
                        y: p.y,
                        width: s.width,
                        height: s.height,
                        scale_factor: m.scale_factor(),
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn element(x: f64, y: f64) -> ScreenElement {
        ScreenElement {
            id: "e1".into(),
            role: "button".into(),
            label: "OK".into(),
            value: None,
            bounds: Rect {
                x,
                y,
                width: 20.0,
                height: 10.0,
            },
        }
    }
    #[test]
    fn resolves_scaled_primary_and_negative_secondary() {
        let monitors = [
            MonitorFrame {
                x: 0,
                y: 0,
                width: 2000,
                height: 1200,
                scale_factor: 2.0,
            },
            MonitorFrame {
                x: -1000,
                y: 0,
                width: 1000,
                height: 900,
                scale_factor: 1.0,
            },
        ];
        let p = locate(&element(100.0, 80.0), &monitors).expect("primary");
        assert_eq!(
            p.rect,
            Rect {
                x: 50.0,
                y: 40.0,
                width: 10.0,
                height: 5.0
            }
        );
        let s = locate(&element(-900.0, 100.0), &monitors).expect("secondary");
        assert_eq!(s.monitor.x, -1000);
        assert_eq!(s.rect.x, 100.0);
    }
    #[test]
    fn off_screen_returns_none() {
        assert!(locate(&element(5000.0, 5000.0), &[]).is_none());
    }
}
