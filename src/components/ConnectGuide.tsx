import { useEffect, useState } from "react";
import {
  IconDeviceGamepad2,
  IconArrowUpRight,
  IconCheck,
  IconCopy,
  IconPlugConnected,
} from "@tabler/icons-react";
import { Button } from "./ui/button";

export function ConnectGuide() {
  useEffect(() => {
    document.title = "Connect your AI | Next Up";
  }, []);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `${location.origin}/api/mcp`;
  return (
    <div className="connection-page">
      <a className="skip-link" href="#connect-main">
        Skip to content
      </a>
      <header className="connection-header">
        <a className="brand" href="/" aria-label="Next Up home">
          <IconDeviceGamepad2 aria-hidden="true" />
          Next Up
        </a>
        <nav aria-label="Main">
          <a href="/">Overview</a>
          <a href="/connect" aria-current="page">
            Connect your AI
          </a>
        </nav>
      </header>
      <main id="connect-main" className="connect-main">
        <section className="connect-intro">
          <div>
            <p className="eyebrow">Next Up + your AI app</p>
            <h1>
              Your backlog.
              <br />
              <span>Part of the conversation.</span>
            </h1>
            <p>
              Ask what to play tonight. Add a game a friend mentioned. Pick up
              where you left off.
            </p>
            <a className="connection-doc-link" href="#setup">
              Connect in three steps ↓
            </a>
          </div>
          <div className="connect-example">
            <IconPlugConnected aria-hidden="true" />
            <p className="eyebrow">Try asking</p>
            <blockquote>
              “I have half an hour and my Steam Deck. What’s in my library?”
            </blockquote>
            <p>
              Your AI checks the games you actually own and explains its
              suggestions.
            </p>
            <span className="connection-label">
              Powered by your library, through MCP
            </span>
          </div>
        </section>
        <section
          id="setup"
          className="connect-setup"
          aria-labelledby="setup-title"
        >
          <div>
            <p className="eyebrow">Get connected</p>
            <h2 id="setup-title">
              Same library.
              <br />
              One new connection.
            </h2>
            <p>
              You’ll need an AI app that supports remote MCP servers and OAuth
              sign-in. Availability depends on the app and its plan.
            </p>
          </div>
          <ol>
            <li>
              <span className="step-number" aria-hidden="true">
                01
              </span>
              <div>
                <h3>Add the server</h3>
                <p>
                  In your AI app’s connections or MCP settings, add a remote
                  server named <strong>Next Up</strong> and paste this URL.
                </p>
                <div className="endpoint-copy">
                  <code>{endpoint}</code>
                  <Button
                    variant="outline"
                    aria-label="Copy MCP server URL"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(endpoint);
                        setCopied(true);
                        setError("");
                      } catch {
                        setError("Copy the URL above manually.");
                      }
                    }}
                  >
                    {copied ? (
                      <IconCheck aria-hidden="true" />
                    ) : (
                      <IconCopy aria-hidden="true" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <span className="sr-only" role="status">
                  {copied ? "Server URL copied" : error}
                </span>
              </div>
            </li>
            <li>
              <span className="step-number" aria-hidden="true">
                02
              </span>
              <div>
                <h3>Sign in and choose access</h3>
                <p>
                  Use your Next Up account. Choose <strong>Read only</strong>{" "}
                  for lookups and recommendations, or{" "}
                  <strong>Read & edit</strong> to manage individual games too.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number" aria-hidden="true">
                03
              </span>
              <div>
                <h3>Ask about your games</h3>
                <p>
                  Try “What’s in my PS5 backlog?” With editing enabled, try
                  “Mark Hades as finished” or “I also own this on Switch 2.”
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="connect-reference" aria-labelledby="tools-heading">
          <div>
            <p className="eyebrow">Under the hood</p>
            <h2 id="tools-heading">What can the connection do?</h2>
            <p>
              MCP is the format your AI app uses to call Next Up’s tools. The AI
              decides which tool fits your request; Next Up checks permissions
              and returns the result.
            </p>
          </div>
          <dl>
            <div>
              <dt>Look things up</dt>
              <dd>
                <code>list_games</code> · <code>get_game</code> ·{" "}
                <code>get_preferences</code>
                <p>Read your library, notes and selected devices.</p>
              </dd>
            </div>
            <div>
              <dt>Find your next game</dt>
              <dd>
                <code>recommend_games</code> · <code>search_catalog</code>
                <p>
                  The same recommendations as Today, plus IGDB title search.
                </p>
              </dd>
            </div>
            <div>
              <dt>Make a change</dt>
              <dd>
                <code>add_game</code> · <code>update_game</code> ·{" "}
                <code>remove_game</code>
                <p>
                  Read & edit access only. One game at a time, with checks
                  against outdated edits.
                </p>
              </dd>
            </div>
          </dl>
        </section>
        <section className="connect-control">
          <div>
            <h2>You stay in control.</h2>
            <p>
              Remove access in Settings → AI connections. There’s no bulk-delete
              tool or settings editor. Your AI app may retain information
              already shared in a chat.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href="/#settings">
              Open Settings{" "}
              <IconArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </a>
          </Button>
        </section>
        <p className="connection-footnote">
          Next Up doesn’t run or bill an AI model. Your AI app’s own pricing and
          data policies apply. Recommendations use your saved preferences;
          session lengths and device compatibility aren’t guessed.
        </p>
      </main>
      <footer className="connection-footer">
        <span>Next Up · Made by David Aparicio</span>
        <a href="https://github.com/Deivbid/next-up">
          Source & technical setup ↗
        </a>
      </footer>
    </div>
  );
}
