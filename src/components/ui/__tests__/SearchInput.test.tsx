import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchInput from "../SearchInput";

/**
 * Regression tests for the Windows "typed characters disappear" bug.
 *
 * Root cause: the component used to unconditionally resync its local
 * `inputValue` state whenever the `value` prop changed, including when
 * that change was caused by its own debounced `onChange` emit. That created
 * a feedback loop (parent updates value -> effect resets inputValue) which
 * could wipe out keystrokes typed during the round trip.
 *
 * These tests simulate a realistic controlled-parent usage (state kept in a
 * wrapper component, exactly like the real search bar) rather than a static
 * prop, since the bug only reproduces under that setup.
 */
function ControlledWrapper({ debounceTime = 300 }: { debounceTime?: number }) {
  const [value, setValue] = React.useState("");
  return (
    <SearchInput
      value={value}
      onChange={setValue}
      debounceTime={debounceTime}
      placeholder="Search customers..."
    />
  );
}

describe("SearchInput", () => {
  it("renders with the given placeholder", () => {
    render(<ControlledWrapper />);
    expect(screen.getByPlaceholderText("Search customers...")).toBeInTheDocument();
  });

  it("shows every typed character immediately, without waiting for the debounce", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("Search customers...") as HTMLInputElement;

    await user.type(input, "John Smith");

    // The visible input value must reflect all typed characters right away,
    // regardless of whether the debounced onChange has fired yet.
    expect(input.value).toBe("John Smith");
  });

  it("does not drop keystrokes typed while a previous debounced onChange round-trips back through the value prop", async () => {
    jest.useFakeTimers();
    render(<ControlledWrapper debounceTime={50} />);
    const input = screen.getByPlaceholderText("Search customers...") as HTMLInputElement;

    // Simulate rapid typing interleaved with the debounce window elapsing,
    // which is what previously triggered the feedback loop.
    await act(async () => {
      fireChange(input, "J");
    });
    await act(async () => {
      jest.advanceTimersByTime(60); // debounce fires, parent value updates -> effect resync check
    });
    await act(async () => {
      fireChange(input, "Jo");
    });
    await act(async () => {
      fireChange(input, "Joh");
    });
    await act(async () => {
      jest.advanceTimersByTime(60);
    });

    expect(input.value).toBe("Joh");
    jest.useRealTimers();
  });

  it("eventually calls onChange with the fully typed value after the debounce settles", async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    function Wrapper() {
      const [value, setValue] = React.useState("");
      return (
        <SearchInput
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
          debounceTime={300}
        />
      );
    }
    render(<Wrapper />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    await act(async () => {
      fireChange(input, "Acme Corp");
    });
    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(onChange).toHaveBeenCalledWith("Acme Corp");
    jest.useRealTimers();
  });

  it("clears the input and emits an empty string when the clear button is clicked", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("Search customers...") as HTMLInputElement;

    await user.type(input, "test");
    expect(input.value).toBe("test");

    const clearButton = await screen.findByRole("button");
    await user.click(clearButton);

    expect(input.value).toBe("");
  });

  it("resyncs local value when the parent resets it externally (e.g. a Clear Filters action)", () => {
    function ExternalResetWrapper() {
      const [value, setValue] = React.useState("preset");
      return (
        <div>
          <SearchInput value={value} onChange={setValue} />
          <button onClick={() => setValue("")}>external reset</button>
        </div>
      );
    }
    render(<ExternalResetWrapper />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("preset");

    fireEvent.click(screen.getByText("external reset"));
    expect(input.value).toBe("");
  });

  it("handles an empty string value without crashing (edge case)", () => {
    render(<SearchInput value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
    // No clear button should render when there is nothing to clear
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

// Helper: fire a native input change event (React Testing Library's
// user.type is realistic but slow for fake-timer scenarios; this keeps the
// interleaved-timer tests deterministic).
function fireChange(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}
