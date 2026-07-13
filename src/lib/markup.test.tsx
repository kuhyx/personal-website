import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderMarkup } from "./markup";

describe("renderMarkup", () => {
  it("renders bold spans and plain text", () => {
    render(<p>{renderMarkup("Built with **React** and care")}</p>);
    const bold = screen.getByText("React");
    expect(bold.tagName).toBe("STRONG");
    expect(screen.getByText(/Built with/)).toBeInTheDocument();
    expect(screen.getByText(/and care/)).toBeInTheDocument();
  });

  it("renders plain text with no markup", () => {
    render(<p data-testid="plain">{renderMarkup("no markup here")}</p>);
    expect(screen.getByTestId("plain")).toHaveTextContent("no markup here");
    expect(screen.queryByText("no markup here")).toBeInTheDocument();
    expect(document.querySelector("strong")).toBeNull();
  });
});
