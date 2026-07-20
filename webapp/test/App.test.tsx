import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import pkg from "../package.json";
import { App } from "../src/App";
import { CLIENT_VERSION } from "../src/version";

describe("App", () => {
  it("renders the client version", () => {
    render(<App />);
    expect(screen.getByTestId("versions")).toHaveTextContent(`client ${CLIENT_VERSION}`);
  });

  it("keeps CLIENT_VERSION in sync with package.json", () => {
    expect(CLIENT_VERSION).toBe(pkg.version);
  });
});
