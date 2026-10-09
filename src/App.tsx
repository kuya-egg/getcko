import { MainWindow } from "./app/MainWindow";
import { SetupProvider } from "./app/setup";

/** Main window. Screens live in src/screens/*, the shell in src/app/*. */
function App() {
  return (
    <SetupProvider>
      <MainWindow />
    </SetupProvider>
  );
}

export default App;
