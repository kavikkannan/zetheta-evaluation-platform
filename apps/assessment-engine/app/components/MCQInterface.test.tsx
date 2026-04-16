import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MCQInterface } from "./MCQInterface";
import React from "react";

const mockQuestions = [
  {
    id: "q_1",
    sequence: 1,
    questionText: "What is 2 + 2?",
    options: [
      { label: "A", text: "3" },
      { label: "B", text: "4" },
    ],
  },
  {
    id: "q_2",
    sequence: 2,
    questionText: "What is the capital of France?",
    options: [
      { label: "A", text: "London" },
      { label: "B", text: "Paris" },
    ],
  },
];

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

global.fetch = vi.fn();

describe("MCQInterface", () => {
  it("renders questions and navigates correctly", async () => {
    render(<MCQInterface questions={mockQuestions} applicationId="app_123" />);

    // Renders first question
    expect(screen.getByText("What is 2 + 2?")).toBeDefined();
    
    // Select correct answer
    const optionB = screen.getByText("4");
    fireEvent.click(optionB);

    // Go to next
    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);

    // Renders second question
    expect(screen.getByText("What is the capital of France?")).toBeDefined();

    // Select second answer
    const optionParis = screen.getByText("Paris");
    fireEvent.click(optionParis);

    // Submit
    const submitBtn = screen.getByText("Submit Assessment");
    
    // Mock the fetch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success" }),
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/submit", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          applicationId: "app_123",
          responses: [
            { questionId: "q_1", answer: "B" },
            { questionId: "q_2", answer: "B" },
          ],
        }),
      }));
      expect(mockPush).toHaveBeenCalledWith("/complete");
    });
  });

  it("shows error if moving next without answer", () => {
    render(<MCQInterface questions={mockQuestions} applicationId="app_123" />);
    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);
    
    expect(screen.getByText(/Please select an answer to continue/)).toBeDefined();
  });
});
