import { error, type Reroute } from "@sveltejs/kit";

// Map POLITEMall's messy activity URLs to our format.
// POLITEMall's ones look like this:
// https://nplms.polite.edu.sg/d2l/le/enhancedSequenceViewer/803172
// ?url=https%3A%2F%2F746e9230-82d6-4d6b-bd68-5aa40aa19cce.sequences.api.brightspace.com%2F803172%2Factivity%2F12156618%3FfilterOnDatesAndDepth%3D1
export const reroute: Reroute = ({ url }) => {
  const match = url.pathname.match(
    /^\/d2l\/le\/enhancedSequenceViewer\/(\d+)\/?$/,
  );
  if (!match) return;

  const moduleId = match[1];
  let activityId: string | undefined;
  try {
    const re = RegExp(String.raw`^/${moduleId}/activity/(\d+)$`);
    const entURL = new URL(url.searchParams.get("url") ?? "");
    activityId = entURL.pathname.match(re)?.[1];
  } catch {
    error(404, "Not found");
  }
  if (!activityId) {
    error(404, "Not found");
  }

  return `/d2l/home/${moduleId}/activity/${activityId}`;
};
