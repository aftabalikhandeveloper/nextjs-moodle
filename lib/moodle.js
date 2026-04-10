// lib/moodle.js

export async function callMoodleAPI(moodleUrl, token, wsfunction, params = {}) {
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: "json",
    ...flattenParams(params),
  });

  console.log(`Moodle API Call [${wsfunction}]: ${body.toString()}`);

  const res = await fetch(`${moodleUrl}/webservice/rest/server.php`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();

  if (data?.exception) {
    console.error("Moodle Exception Details:", JSON.stringify(data, null, 2));
    throw new Error(`Moodle error: ${data.message} (${data.errorcode})`);
  }

  return data;
}

export async function getMoodleUserID(moodleUrl, token) {
  const info = await callMoodleAPI(moodleUrl, token, "core_webservice_get_site_info", {});
  return info.userid;
}

/**
 * Flatten nested objects/arrays into Moodle's expected flat key format.
 * e.g. data: [{name:"x",value:"y"}]
 *   => data[0][name]=x&data[0][value]=y
 */
function flattenParams(obj, prefix = "") {
  const result = {};

  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (val === null || val === undefined) {
      result[fullKey] = "";
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (item !== null && typeof item === "object") {
          Object.assign(result, flattenParams(item, `${fullKey}[${i}]`));
        } else {
          result[`${fullKey}[${i}]`] = String(item ?? "");
        }
      });
    } else if (typeof val === "object") {
      Object.assign(result, flattenParams(val, fullKey));
    } else {
      result[fullKey] = String(val);
    }
  }

  return result;
}