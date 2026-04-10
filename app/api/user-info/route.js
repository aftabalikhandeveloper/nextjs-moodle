import { NextResponse } from "next/server";
import { getUserInfo } from "@/lib/userInfoService";

export async function GET() {
  try {
    const userInfo = await getUserInfo();
    return NextResponse.json(userInfo);
  } catch (error) {
    const status = error?.status || 500;
    const message = status === 401 ? "Unauthorized" : "Failed to fetch user info";

    if (status !== 401) {
      console.error("Error fetching user info:", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}