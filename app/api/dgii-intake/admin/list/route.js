import { NextResponse } from "next/server";
import { auth } from "@/auth";
import DgiiIntake from "@/app/models/dgiiIntake";
import User from "@/app/models/user";
import { buildCompletionStatus } from "@/lib/dgiiIntake/status";
import { normalizeRnc } from "@/lib/dgiiIntake/normalizeRnc";
import {
  buildIntakePublicUrl,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/createForUser";
import { headers } from "next/headers";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

async function baseUrl() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return resolveDgiiIntakePublicBaseUrl(`${proto}://${host}`);
}

function displayStatus(intake) {
  const now = new Date();
  if (intake.status === "expired" || (intake.expiresAt && new Date(intake.expiresAt) <= now)) {
    return "expired";
  }
  if (intake.status === "complete") return "complete";
  return "in_progress";
}

/** GET — list all DGII intakes for admin table */
export async function GET(request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const filter = {};
    if (status === "complete") filter.status = "complete";
    else if (status === "expired") filter.status = "expired";
    else if (status === "in_progress") {
      filter.status = { $in: ["open", "submitted"] };
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = { $regex: escaped, $options: "i" };
      const digits = normalizeRnc(search);
      const userMatchFilter = digits
        ? {
            $or: [
              { "empresa.rnc": re },
              { "empresa.rnc": digits },
              {
                "empresa.rnc": {
                  $regex: digits.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  $options: "i",
                },
              },
            ],
          }
        : { "empresa.rnc": re };
      const matchingUsers = await User.find(userMatchFilter).select("_id").lean();
      const matchedUserIds = matchingUsers.map((u) => u._id);
      filter.$or = [
        { clientName: re },
        { clientEmail: re },
        { "empresa.nombre": re },
        { "empresa.razonSocial": re },
        { "empresa.rnc": re },
        ...(matchedUserIds.length ? [{ userId: { $in: matchedUserIds } }] : []),
      ];
    }

    const [rows, total] = await Promise.all([
      DgiiIntake.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DgiiIntake.countDocuments(filter),
    ]);

    const root = await baseUrl();
    const userIds = [
      ...new Set(
        rows
          .map((doc) => doc.userId)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];
    const linkedUsers = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select("empresa.rnc")
          .lean()
      : [];
    const rncByUserId = new Map(
      linkedUsers.map((u) => [String(u._id), normalizeRnc(u.empresa?.rnc)])
    );

    const intakes = rows.map((doc) => {
      const plain = doc.toObject();
      const completion = buildCompletionStatus(plain);
      const uiStatus = displayStatus(plain);
      const userId = plain.userId ? String(plain.userId) : "";
      return {
        id: String(plain._id),
        clientName: plain.clientName || plain.empresa?.nombre || "—",
        clientEmail: plain.clientEmail || "",
        rnc: (userId && rncByUserId.get(userId)) || "",
        userEmpresaRnc: (userId && rncByUserId.get(userId)) || "",
        status: uiStatus,
        dbStatus: plain.status,
        createdAt: plain.createdAt,
        expiresAt: plain.expiresAt,
        completedAt: plain.completedAt || null,
        lastSavedAt: plain.lastSavedAt || null,
        completion,
        url: buildIntakePublicUrl(root, plain.token),
        tokenPreview: `${String(plain.token || "").slice(0, 8)}…`,
        hasFiles: {
          cedulaFrente: Boolean(
            plain.files?.cedulaFrente?.url || plain.files?.cedula?.url
          ),
          cedulaReverso: Boolean(plain.files?.cedulaReverso?.url),
          factura1: Boolean(plain.files?.factura1?.url),
          factura2: Boolean(plain.files?.factura2?.url),
          factura3: Boolean(plain.files?.factura3?.url),
          factura4: Boolean(plain.files?.factura4?.url),
          factura5: Boolean(plain.files?.factura5?.url),
          registroMercantil: Boolean(plain.files?.registroMercantil?.url),
          logo: Boolean(plain.files?.logo?.url),
          certificadoP12: Boolean(plain.files?.certificadoP12?.url),
        },
      };
    });

    return NextResponse.json({
      intakes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("GET /api/dgii-intake/admin/list:", err?.message || err);
    return NextResponse.json(
      { error: "Error al listar formularios DGII" },
      { status: 500 }
    );
  }
}
