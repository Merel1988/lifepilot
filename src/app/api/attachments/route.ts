import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

// Upload attachment (accepts multipart form data)
export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const itemId = formData.get("itemId") as string | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  // Limit file size to 10MB
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const attachment = await prisma.attachment.create({
    data: {
      itemId: itemId || null,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data: buffer,
    },
  });

  return Response.json({
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: `/api/attachments/${attachment.id}`,
  }, { status: 201 });
}
