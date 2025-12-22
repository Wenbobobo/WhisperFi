import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProofProgressBar from "./ProofProgressBar";

describe("ProofProgressBar", () => {
  it("renders building stage with correct label", () => {
    render(<ProofProgressBar stage="building" progress={15} />);
    expect(screen.getByText(/Building Merkle Tree.../i)).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("renders generating stage with correct label", () => {
    render(<ProofProgressBar stage="generating" progress={60} />);
    expect(screen.getByText(/Generating Proof.../i)).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("renders preparing stage with correct label", () => {
    render(<ProofProgressBar stage="preparing" progress={95} />);
    expect(screen.getByText(/Preparing Submission.../i)).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("renders complete stage with correct label", () => {
    render(<ProofProgressBar stage="complete" progress={100} />);
    expect(screen.getByText(/Complete!/i)).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps progress to 0-100 range", () => {
    const { rerender } = render(<ProofProgressBar stage="building" progress={-10} />);
    expect(screen.getByText("0%")).toBeInTheDocument();

    rerender(<ProofProgressBar stage="building" progress={150} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows helper text for non-complete stages", () => {
    render(<ProofProgressBar stage="building" progress={10} />);
    expect(
      screen.getByText(/This may take a moment. Please do not close this window./i)
    ).toBeInTheDocument();
  });

  it("does not show helper text for complete stage", () => {
    render(<ProofProgressBar stage="complete" progress={100} />);
    expect(
      screen.queryByText(/This may take a moment. Please do not close this window./i)
    ).not.toBeInTheDocument();
  });

  it("does not render when visible is false", () => {
    render(<ProofProgressBar stage="building" progress={10} visible={false} />);
    expect(screen.queryByTestId("proof-progress-bar")).not.toBeInTheDocument();
  });

  it("renders when visible is true", () => {
    render(<ProofProgressBar stage="building" progress={10} visible={true} />);
    expect(screen.getByTestId("proof-progress-bar")).toBeInTheDocument();
  });

  it("renders with default visible=true when prop not provided", () => {
    render(<ProofProgressBar stage="building" progress={10} />);
    expect(screen.getByTestId("proof-progress-bar")).toBeInTheDocument();
  });

  it("transitions smoothly between stages", () => {
    const { rerender } = render(<ProofProgressBar stage="building" progress={30} />);
    expect(screen.getByText(/Building Merkle Tree.../i)).toBeInTheDocument();

    rerender(<ProofProgressBar stage="generating" progress={60} />);
    expect(screen.getByText(/Generating Proof.../i)).toBeInTheDocument();

    rerender(<ProofProgressBar stage="preparing" progress={95} />);
    expect(screen.getByText(/Preparing Submission.../i)).toBeInTheDocument();

    rerender(<ProofProgressBar stage="complete" progress={100} />);
    expect(screen.getByText(/Complete!/i)).toBeInTheDocument();
  });
});
