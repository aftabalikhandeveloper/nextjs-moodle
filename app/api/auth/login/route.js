import { NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request) {
  const { username, password } = await request.json();
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  if (username === envUser && password === envPass) {
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await encrypt({ username, expires });

    (await cookies()).set("session", session, { 
       expires, 
       httpOnly: true, 
       secure: process.env.NODE_ENV === "production",
       path: "/"
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
}
