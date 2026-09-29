import {
  IconDeviceGamepad2,
  IconBrandGoogle,
  IconArrowUpRight,
} from "@tabler/icons-react";
import { Button } from "./ui/button";
import "./landing.css";
export function Landing({
  onLogin,
  busy,
  error,
}: {
  onLogin: () => void;
  busy: boolean;
  error: string;
}) {
  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-shell">
        <a className="brand" href="/" aria-label="Next Up home">
          <IconDeviceGamepad2 aria-hidden="true" />
          Next Up
        </a>
        <nav className="landing-nav" aria-label="Main">
          <a href="/connect">Connect your AI</a>
          <Button variant="ghost" onClick={onLogin} disabled={busy}>
            Log in <IconArrowUpRight aria-hidden="true" />
          </Button>
        </nav>
      </header>
      <main id="landing-main">
        <section className="landing-hero landing-shell">
          <div>
            <p className="eyebrow">PC · Steam Deck · PS5 · Switch 2</p>
            <h1>
              Your games.
              <br />
              <span>One place.</span>
            </h1>
            <p className="landing-intro">
              Keep your library together and find something to play with the
              time you have.
            </p>
            <Button size="lg" onClick={onLogin} disabled={busy}>
              <IconBrandGoogle aria-hidden="true" />
              {busy ? "Opening Google…" : "Continue with Google"}
            </Button>
            <p className="landing-small">
              Your library comes with you when you switch devices.
            </p>
            {error && (
              <p className="landing-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <aside>
            <span aria-hidden="true">↳</span>
            <p>
              A few games on PC.
              <br />A few on the console.
              <br />
              <strong>Now you can see them together.</strong>
            </p>
          </aside>
        </section>
        <section className="landing-shell" aria-labelledby="preview-title">
          <h2 id="preview-title" className="landing-preview-title">
            Here’s what your library can look like.
          </h2>
          <img
            className="landing-preview"
            src="/landing-today.jpg"
            fetchPriority="high"
            width="1440"
            height="1382"
            alt="Next Up with Cyberpunk 2077 as the current game and suggestions for a short session on Steam Deck."
          />
          <p className="landing-small">
            Example games. You choose what goes in yours.
          </p>
        </section>
        <section className="landing-details landing-shell">
          <div>
            <p className="eyebrow">Why I made this</p>
            <h2>
              I had plenty of games.
              <br />
              Picking one was the hard part.
            </h2>
            <p>
              Between work and everything else, I wanted to spend less of my
              free time browsing my backlog.
            </p>
          </div>
          <dl>
            <div>
              <dt>Keep track of your games</dt>
              <dd>
                Separate what you own from your wishlist. Add games yourself or
                choose which ones to import from Steam.
              </dd>
            </div>
            <div>
              <dt>Find something for tonight</dt>
              <dd>
                Pick a device and the time you have. Get a few suggestions from
                your own library.
              </dd>
            </div>
            <div>
              <dt>Come back when you want</dt>
              <dd>
                Mark games as playing, paused or finished. Add a note if it
                helps you remember where you left off.
              </dd>
            </div>
          </dl>
        </section>
      </main>
      <footer className="landing-shell">
        <span>Next Up · Made by David Aparicio</span>
        <a href="https://github.com/Deivbid/next-up">GitHub ↗</a>
      </footer>
    </div>
  );
}
