import { NextResponse } from "next/server";

export async function POST(request) {
  const { password } = await request.json();
  const correctPassword = process.env.APP_PASSWORD || "vaynersports2025";

  if (password === correctPassword) {
    const response = NextResponse.json({ success: true });
    response.cookies.set("agent_reg_auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  return NextResponse.json({ success: false, error: "Wrong password" }, { status: 401 });
}
