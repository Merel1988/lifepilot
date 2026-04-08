import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Download/serve attachment
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
  });

  if (!attachment) {
    return new Response("Not Found", { status: 404 });
  }

  const isInline = attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf";

  return new Response(attachment.data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.filename)}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}

// Delete attachment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  await prisma.attachment.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
