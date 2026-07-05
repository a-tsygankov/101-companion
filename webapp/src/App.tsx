import { SCHEMA_VERSION } from "@101/schema";
import { CLIENT_VERSION } from "./version";

export function App() {
  return (
    <main>
      <h1>101 Companion</h1>
      <p data-testid="versions">
        client {CLIENT_VERSION} · schema {SCHEMA_VERSION}
      </p>
    </main>
  );
}
