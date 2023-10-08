import { beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("index", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("calls run when imported", () => {
    jest.doMock("./main", () => ({
      run: jest.fn(() => Promise.resolve()),
    }));

    const { run } = require("./main"); // Import after setting up the mock
    require("./index");

    expect(run).toHaveBeenCalled();
  });

  it("sets action failed when there is an error", async () => {
    jest.doMock("@actions/core", () => ({
      setFailed: jest.fn(),
    }));

    const mockError = new Error("An error occurred");
    jest.doMock("./main", () => ({
      run: jest.fn(() => Promise.reject(mockError)),
    }));

    const { setFailed } = require("@actions/core"); // Import after setting up the mock
    await require("./index");

    expect(setFailed).toHaveBeenCalledWith(mockError)
  });
});
