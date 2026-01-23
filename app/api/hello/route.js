import { NextResponse } from "next/server";

export async function GET(request) {
  return NextResponse.json({ message: "Hello, GET request!" });
}

export async function POST(request) {
  const { message } = await request.json();
  return NextResponse.json({ message: `Hello, POST request! ${message}` });
}