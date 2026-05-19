import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import HomePage from "../pages/HomePage";

describe("HomePage", () => {
  it("renders hero copy", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/동아리 운영을/)).toBeInTheDocument();
  });
});
