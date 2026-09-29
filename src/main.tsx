import React from "react";
import { createRoot } from "react-dom/client";
import { ConnectGuide } from "./components/ConnectGuide";
import { AccountGate } from "./components/AccountGate";
import "@fontsource-variable/geist";
import "./style.css";
class StorageBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="app-main">
          <h1>We couldn’t open Next Up.</h1>
          <p>
            Check that browser storage is allowed, then reload. Your existing
            library has not been deleted.
          </p>
          <button onClick={() => location.reload()}>Reload Next Up</button>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StorageBoundary>
      {location.pathname === "/connect" ? <ConnectGuide /> : <AccountGate />}
    </StorageBoundary>
  </React.StrictMode>,
);
