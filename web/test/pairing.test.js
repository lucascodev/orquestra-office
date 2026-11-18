import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deviceLabelOf } from "../scripts/domain/office/device-label.js";
import { pairingCodeOf } from "../scripts/domain/office/pairing-fragment.js";
import { phoneLinkOf } from "../scripts/domain/office/phone-link.js";

const CODE = "AAECAwQFBgcICQoLDA0ODw";

describe("pairing fragment", () => {
  it("reads the code the opener or the QR put after #pair=", () => {
    assert.equal(pairingCodeOf(`#pair=${CODE}`), CODE);
  });

  it("ignores anything that is not a 16-byte code", () => {
    for (const hash of ["", "#", "#pair=", "#pair=short", `#pair=${CODE}x`, `#other=${CODE}`, `#pair=${CODE.slice(0, -1)}+`, null, undefined]) {
      assert.equal(pairingCodeOf(hash), null, String(hash));
    }
  });
});

describe("device label", () => {
  it("names the browser and the system from the user agent", () => {
    const cases = [
      ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36", "Chrome no Windows"],
      ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0", "Edge no Windows"],
      ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "Safari no macOS"],
      ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari no iPhone"],
      ["Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36", "Chrome no Android"],
      ["Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0", "Firefox no Linux"],
    ];
    for (const [userAgent, label] of cases) assert.equal(deviceLabelOf(userAgent), label, userAgent);
  });

  it("falls back to a plain name for an unknown agent", () => {
    assert.equal(deviceLabelOf(""), "Navegador");
    assert.equal(deviceLabelOf(undefined), "Navegador");
  });
});

describe("phone link", () => {
  it("prefers the network address, since a phone cannot reach this machine's localhost", () => {
    assert.equal(phoneLinkOf(["http://localhost:8420/#pair=x", "http://192.168.0.50:8420/#pair=x"]), "http://192.168.0.50:8420/#pair=x");
    assert.equal(phoneLinkOf(["http://127.0.0.1:8420/#pair=x"]), "http://127.0.0.1:8420/#pair=x");
    assert.equal(phoneLinkOf([]), null);
  });
});
