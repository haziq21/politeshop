import { defineExtensionMessaging } from "@webext-core/messaging";
import type { SessionCredential } from ".";

interface ProtocolMap {
  refreshPOLITECredentials(data: { subdomain: string }): SessionCredential[];
  setBrightspaceCredentials(data: {
    d2lFetchToken: string;
    subdomain: string;
  }): void;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
