import { describe, it, expect, vi } from "vitest";
import { memoryStorage } from "./editor-parts";
import { memoryFiles } from "./files";
import { OfflineStore } from "./offline-store";
import {
  POST, blog, el, input, json, mount, pick, reconnect, server, settle, status, submit, tone,
} from "../../test/admin-editor";

/** Images, offline first: a picked file lands on the device and uploads when it can. */
const shot = (): File => new File(["bytes"], "shot.png", { type: "image/png" });
const open = async (): Promise<void> => {
  el("post-list").querySelector("button")?.dispatchEvent(new Event("click"));
  await settle();
};

describe("images", () => {
  it("refuses to upload before the post has a slug", async () => {
    await mount(server(blog([])).fetch, memoryStorage());
    const picker = vi.spyOn(input("image-input"), "click");
    el("upload").dispatchEvent(new Event("click"));
    expect(status()).toMatch(/slug/);
    expect(picker).not.toHaveBeenCalled();
  });

  it("opens the file picker once there is a slug", async () => {
    await mount(server(blog([])).fetch, memoryStorage());
    input("slug").value = "hello";
    const picker = vi.spyOn(input("image-input"), "click");
    el("upload").dispatchEvent(new Event("click"));
    expect(picker).toHaveBeenCalledOnce();
  });

  it("does nothing when the picker is dismissed with no file", async () => {
    const api = server(blog([]));
    await mount(api.fetch, memoryStorage());
    input("image-input").dispatchEvent(new Event("change"));
    await settle();
    expect(api.calls.filter((call) => call.includes("images"))).toEqual([]);
  });

  it("uploads at once when online, inserting the markdown", async () => {
    const api = server(blog([POST]));
    const files = memoryFiles();
    const storage = memoryStorage();
    await mount(api.fetch, storage, { files });
    await open();
    pick(shot());
    await settle();
    expect(api.uploads).toEqual(["shot.png:5"]);
    expect((el("body") as HTMLTextAreaElement).value).toBe("Body text.\n\n![](./shot.png)");
    expect(el("images").textContent).toContain("shot.png");
    expect(new OfflineStore(storage).pending()).toEqual([]);
  });

  it("keeps an image picked offline, shows it, and uploads it on reconnect", async () => {
    const api = server(blog([POST]));
    const files = memoryFiles();
    const storage = memoryStorage();
    await mount(api.fetch, storage, { files });
    await open();
    api.plugged = false;
    pick(shot());
    await settle();
    expect((el("body") as HTMLTextAreaElement).value).toContain("![](./shot.png)");
    expect(el("images").textContent).toContain("shot.png");
    expect(tone()).toBe("offline");

    await mount(api.fetch, storage, { files });
    await open();
    expect(el("images").textContent).toContain("shot.png");

    api.plugged = true;
    reconnect.fire();
    await settle();
    expect(api.uploads).toEqual(["shot.png:5"]);
    expect(new OfflineStore(storage).pending()).toEqual([]);
    const [op] = api.calls.filter((call) => call.startsWith("POST"));
    expect(op).toBe("POST /api/posts/hello/images");
  });

  it("uploads a queued image before the save that references it", async () => {
    const api = server(blog([POST]));
    const storage = memoryStorage();
    await mount(api.fetch, storage, { files: memoryFiles() });
    await open();
    api.plugged = false;
    pick(shot());
    await settle();
    submit("hello", "Hello");
    await settle();
    api.plugged = true;
    reconnect.fire();
    await settle();
    expect(api.calls.filter((call) => !call.startsWith("GET"))).toEqual([
      "POST /api/posts/hello/images",
      "PUT /api/posts/hello",
    ]);
  });

  it("reports an image the server refuses", async () => {
    const api = server((method, path) =>
      method === "POST" ? json({ error: "image is empty" }, 400) : blog([POST])(method, path));
    await mount(api.fetch, memoryStorage(), { files: memoryFiles() });
    await open();
    pick(new File([], "shot.png"));
    await settle();
    expect(status()).toBe("image is empty");
  });

  it("reports a queued image whose bytes are gone from the device", async () => {
    const api = server(blog([POST]));
    const storage = memoryStorage();
    new OfflineStore(storage).queueImage("hello", "lost.png", "nowhere");
    await mount(api.fetch, storage, { files: memoryFiles() });
    expect(tone()).toBe("bad");
    expect(status()).toBe("lost.png is no longer on this device");
  });

  it("drops a deleted post's queued images from the device", async () => {
    const api = server(blog([POST]));
    const files = memoryFiles();
    await mount(api.fetch, memoryStorage(), { files, newId: () => "1" });
    await open();
    api.plugged = false;
    pick(shot());
    await settle();
    el("delete").dispatchEvent(new Event("click"));
    await settle();
    expect(await files.get("hello/shot.png/1")).toBeNull();
  });

  it("frees the old bytes when the same name is picked again offline", async () => {
    const api = server(blog([POST]));
    const files = memoryFiles();
    await mount(api.fetch, memoryStorage(), { files, newId: ((n) => () => String(++n))(0) });
    await open();
    api.plugged = false;
    pick(shot());
    await settle();
    pick(new File(["newer"], "shot.png"));
    await settle();
    expect(await files.get("hello/shot.png/1")).toBeNull();
    expect(await (await files.get("hello/shot.png/2"))?.text()).toBe("newer");
  });
});

describe("an image for a post not saved yet", () => {
  it("lists the image under its own name and keeps the bytes under a fresh id", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("0-0-0-0-0");
    const api = server(blog([]));
    const files = memoryFiles();
    await mount(api.fetch, memoryStorage(), { files });
    api.plugged = false;
    input("slug").value = "fresh";
    pick(shot());
    await settle();
    expect(el("images").textContent).toContain("shot.png");
    expect(await files.get("fresh/shot.png/0-0-0-0-0")).not.toBeNull();
  });
});

describe("after an offline save of a new post", () => {
  it("offers delete straight away", async () => {
    const api = server(blog([]));
    await mount(api.fetch, memoryStorage());
    api.plugged = false;
    submit("trip", "Trip");
    await settle();
    expect(el("delete").hidden).toBe(false);
  });
});

describe("the page shell", () => {
  it("registers the worker that opens the editor with the server down", async () => {
    const register = vi.fn(() => Promise.resolve({}));
    await mount(server(blog([])).fetch, memoryStorage(), { serviceWorker: { register } });
    expect(register).toHaveBeenCalledWith("/admin/assets/sw.js", { scope: "/admin" });
  });

  it("says so when the worker cannot be registered", async () => {
    const register = vi.fn(() => Promise.reject(new Error("insecure origin")));
    await mount(server(blog([])).fetch, memoryStorage(), { serviceWorker: { register } });
    expect(tone()).toBe("bad");
    expect(status()).toBe("insecure origin");
  });
});
