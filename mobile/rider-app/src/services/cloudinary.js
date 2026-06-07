/**
 * Cloudinary signed-upload client.
 *
 * Flow:
 *   1. POST /auth/upload-signature { kind, requestId? }
 *      → { signature, timestamp, apiKey, cloudName, folder, publicId, kind }
 *      (see backend `getCloudinaryUploadSignature` in auth.service.js).
 *   2. Construct Cloudinary upload URL from cloudName.
 *   3. multipart POST to Cloudinary with file + signed params.
 *   4. Caller persists `secure_url` to the relevant slice.
 *
 * Backend kind support:
 *   profile / prescription / return / product / dispute / ticket / pod /
 *   pod_signature. POD kinds require `scopeId = requestId` and the rider
 *   must be assigned to that request while it's PICKED_UP or IN_TRANSIT.
 */

import { Platform } from "react-native";
import api from "./api";
import { newIdempotencyKey } from "./idempotency";

const RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

/**
 * Upload a local image to Cloudinary via the backend-issued signed upload.
 *
 * @param {object} opts
 * @param {string} opts.kind        - upload kind handled by backend `/auth/upload-signature`
 * @param {string} opts.localUri    - file:// URI for the image
 * @param {string} [opts.requestId] - required for request-scoped kinds (pod, pod_signature)
 * @param {string} [opts.mimeType="image/jpeg"]
 * @param {AbortSignal} [opts.signal] - optional cancel signal
 * @returns {Promise<{ secureUrl: string, publicId: string }>}
 */
export async function uploadToCloudinary({ kind, localUri, requestId, mimeType = "image/jpeg", signal }) {
  if (!kind) throw new Error("upload kind is required");
  if (!localUri) throw new Error("local URI is required");

  let lastError;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    if (signal?.aborted) throw new Error("upload aborted");

    try {
      // 1. Fresh signature per attempt — server caps timestamp skew, so a
      //    signature that idles too long fails. Refresh is cheap. POD kinds
      //    pass the requestId so the server can verify the rider's assignment.
      const signBody = requestId ? { kind, requestId } : { kind };
      const signResp = await api.post(
        "/auth/upload-signature",
        signBody,
        { headers: { "Idempotency-Key": newIdempotencyKey() } },
      );
      const sig = signResp?.data || signResp;
      if (!sig?.signature || !sig?.timestamp || !sig?.apiKey || !sig?.cloudName) {
        throw new Error("Malformed upload-signature response");
      }
      if (!sig?.folder || !sig?.publicId) {
        throw new Error("Upload signature missing folder or publicId");
      }

      // 2. Cloudinary upload endpoint for this cloud.
      const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;

      // 3. Multipart form. Fields MUST match what the backend hashed into the
      //    signature (folder, public_id, timestamp); anything else here is
      //    metadata Cloudinary ignores for signing.
      const form = new FormData();
      if (Platform.OS === "web") {
        // On web, `localUri` is a data:/blob: URL. Cloudinary needs a real Blob,
        // not React Native's { uri, name, type } descriptor — so fetch the URL
        // into a Blob and append that. Native keeps the RN descriptor below.
        const blob = await fetch(localUri).then((r) => r.blob());
        const ext = mimeType === "image/png" ? "png" : "jpg";
        form.append("file", blob, `${sig.publicId}.${ext}`);
      } else {
        form.append("file", {
          uri: localUri,
          name: `${sig.publicId}.jpg`,
          type: mimeType,
        });
      }
      form.append("api_key", String(sig.apiKey));
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", String(sig.signature));
      form.append("folder", String(sig.folder));
      form.append("public_id", String(sig.publicId));

      // 4. Use fetch directly — axios + RN can mishandle FormData boundaries on
      //    some Android builds.
      const cloudinaryResp = await fetch(uploadUrl, {
        method: "POST",
        body: form,
        signal,
      });
      if (!cloudinaryResp.ok) {
        const text = await cloudinaryResp.text();
        throw new Error(`Cloudinary ${cloudinaryResp.status}: ${text}`);
      }
      const json = await cloudinaryResp.json();
      if (!json?.secure_url) throw new Error("Cloudinary returned no secure_url");

      return { secureUrl: json.secure_url, publicId: json.public_id };
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Phase 5 — Proof of Delivery upload convenience wrapper.
 *
 * `assetKind`:
 *   - "photo"     → backend kind `pod`
 *   - "signature" → backend kind `pod_signature`
 *
 * Both kinds are request-scoped on the backend: signing requires the
 * caller to be the assigned rider on the request, and the request must be
 * between PICKED_UP and DELIVERED.
 *
 * @param {object} opts
 * @param {"photo"|"signature"} opts.assetKind
 * @param {string} opts.localUri
 * @param {string} opts.requestId
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ secureUrl: string, publicId: string }>}
 */
export function uploadPodAsset({ assetKind, localUri, requestId, signal }) {
  if (!requestId) throw new Error("uploadPodAsset requires a requestId");
  const kind = assetKind === "signature" ? "pod_signature" : "pod";
  // Signatures are PNG (transparent background); photos are JPEG.
  const mimeType = assetKind === "signature" ? "image/png" : "image/jpeg";
  return uploadToCloudinary({ kind, localUri, requestId, mimeType, signal });
}
