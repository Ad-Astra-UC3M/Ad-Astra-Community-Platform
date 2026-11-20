import { rmSync } from "node:fs";
import { eq } from "drizzle-orm";

import { bootstrapAdmin } from "../scripts/bootstrap-admin";
import { closeDb, getDb } from "../src/db/client";
import { activities, opportunities, profiles, shifts } from "../src/db/schema";
import { createTestAuthProvider, getLatestTestOtp } from "../src/lib/auth/test-auth-provider";
import { registerAccount, verifyAccountEmail } from "../src/server/auth/service";
import { reserveShift } from "../src/server/repositories/activities";
import { createAdminActivity, setProfileCapability } from "../src/server/repositories/admin";
import { createOpportunity } from "../src/server/repositories/opportunities";
import { E2E_ACCOUNTS } from "./helpers/e2e-env";

async function seedVerifiedUser(
  db: Awaited<ReturnType<typeof getDb>>,
  authProvider: ReturnType<typeof createTestAuthProvider>,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    degree: string;
    course: string;
  },
): Promise<{ profileId: string; authUserId: string }> {
  const existing = await db
    .select({ id: profiles.id, authUserId: profiles.authUserId })
    .from(profiles)
    .where(eq(profiles.email, input.email.toLowerCase()))
    .limit(1);

  if (existing[0]?.authUserId) {
    return { profileId: existing[0].id, authUserId: existing[0].authUserId };
  }

  const reg = await registerAccount(db, authProvider, {
    ...input,
    privacyAccepted: true,
  });
  if (!reg.ok) {
    throw new Error(`Failed seeding ${input.email}: ${reg.error}`);
  }

  const otp = await getLatestTestOtp(db, input.email, "email-verification");
  if (!otp) {
    throw new Error(`Missing verification OTP for ${input.email}`);
  }

  const verified = await verifyAccountEmail(db, authProvider, { email: input.email, otp });
  if (!verified.ok) {
    throw new Error(`Failed verifying ${input.email}: ${verified.error}`);
  }

  await authProvider.signOut();
  return { profileId: reg.profileId, authUserId: reg.authUserId };
}

async function main() {
  const dataDir = process.env.AD_ASTRA_PG_TEST_DIR?.trim();
  if (!dataDir) {
    throw new Error("AD_ASTRA_PG_TEST_DIR is required for E2E seeding.");
  }

  // Start from a clean PGlite directory for each Playwright run.
  rmSync(dataDir, { recursive: true, force: true });

  const mailboxFile = process.env.AD_ASTRA_TEST_MAILBOX_FILE?.trim();
  if (mailboxFile) {
    rmSync(mailboxFile, { force: true });
  }

  const db = await getDb();
  try {
    const authProvider = createTestAuthProvider(db);

    const admin = await seedVerifiedUser(db, authProvider, {
      firstName: "Elena",
      lastName: "Admin",
      email: E2E_ACCOUNTS.admin.email,
      password: E2E_ACCOUNTS.admin.password,
      degree: "Ingeniería Aeroespacial",
      course: "4.º",
    });

    await bootstrapAdmin(db, E2E_ACCOUNTS.admin.email);

    for (const cap of ["content_editing", "attendance_validation", "talent_consultation"] as const) {
      await setProfileCapability(admin.profileId, cap, true, admin.profileId, db);
    }

    const generalOnly = await seedVerifiedUser(db, authProvider, {
      firstName: "Carlos",
      lastName: "General",
      email: E2E_ACCOUNTS.generalAdminOnly.email,
      password: E2E_ACCOUNTS.generalAdminOnly.password,
      degree: "Ingeniería Industrial",
      course: "3.º",
    });
    await setProfileCapability(generalOnly.profileId, "general_admin", true, admin.profileId, db);

    const student = await seedVerifiedUser(db, authProvider, {
      firstName: "Lucía",
      lastName: "Estudiante",
      email: E2E_ACCOUNTS.student.email,
      password: E2E_ACCOUNTS.student.password,
      degree: "Ingeniería Aeroespacial",
      course: "2.º",
    });

    await seedVerifiedUser(db, authProvider, {
      firstName: "Mateo",
      lastName: "Estudiante",
      email: E2E_ACCOUNTS.studentTwo.email,
      password: E2E_ACCOUNTS.studentTwo.password,
      degree: "Ingeniería Aeroespacial",
      course: "3.º",
    });

    await seedVerifiedUser(db, authProvider, {
      firstName: "Sara",
      lastName: "Puerta",
      email: E2E_ACCOUNTS.doorCandidate.email,
      password: E2E_ACCOUNTS.doorCandidate.password,
      degree: "Ingeniería Mecánica",
      course: "2.º",
    });

    const filler = await seedVerifiedUser(db, authProvider, {
      firstName: "Diego",
      lastName: "Reserva",
      email: "diego.reserva@alumnos.uc3m.es",
      password: "FillerUser2026!",
      degree: "Ingeniería Aeroespacial",
      course: "4.º",
    });

    const now = new Date();
    const dayWorkshop = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 10] as const;
    const dayVisit = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 12] as const;
    const dayAvionics = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 14] as const;

    const existingActivities = await db.select({ slug: activities.slug }).from(activities);
    if (existingActivities.length === 0) {
      const workshop = await createAdminActivity(
        {
          slug: "cubesat-lab",
          title: "Taller de integración de un CubeSat",
          description:
            "Monta la estructura de un CubeSat didáctico y comprueba el encaje de sus placas. Los dos turnos cubren la misma práctica.",
          location: "Aula de prototipado · Campus de Leganés",
          status: "published",
          shifts: [
            {
              name: "Turno de mañana",
              startsAt: new Date(Date.UTC(...dayWorkshop, 9, 30)),
              endsAt: new Date(Date.UTC(...dayWorkshop, 11, 0)),
              capacity: 8,
            },
            {
              name: "Turno de tarde",
              startsAt: new Date(Date.UTC(...dayWorkshop, 15, 30)),
              endsAt: new Date(Date.UTC(...dayWorkshop, 17, 0)),
              capacity: 1,
            },
          ],
        },
        admin.profileId,
        db,
      );
      if (!workshop.ok) throw new Error(`Workshop seed failed: ${workshop.error}`);

      const lateShift = workshop.activity.shifts.find((s) => s.name === "Turno de tarde");
      if (!lateShift) throw new Error("Missing late shift");
      await reserveShift(workshop.activity.id, lateShift.id, filler.profileId, now, db);

      const visit = await createAdminActivity(
        {
          slug: "propulsion-visit",
          title: "Visita guiada al banco de ensayos",
          description:
            "Recorrido técnico por la bancada de pruebas de propulsión y la instrumentación de telemetría de Ad Astra UC3M.",
          location: "Laboratorio de propulsión · Campus de Leganés",
          status: "published",
          startsAt: new Date(Date.UTC(...dayVisit, 11, 0)),
          endsAt: new Date(Date.UTC(...dayVisit, 12, 30)),
          capacity: 20,
          images: [
            {
              imageUrl: "https://www.adastrauc3m.es/og-image.png",
              imageAlt: "Vista general del banco de ensayos de propulsión de Ad Astra UC3M",
              position: 1,
            },
            {
              imageUrl: "https://www.adastrauc3m.es/logo.png",
              imageAlt: "Instrumentación y panel de telemetría del laboratorio",
              position: 2,
            },
          ],
        },
        admin.profileId,
        db,
      );
      if (!visit.ok) throw new Error(`Visit seed failed: ${visit.error}`);

      const avionics = await createAdminActivity(
        {
          slug: "avionics-lab",
          title: "Práctica de telemetría y aviónica",
          description:
            "Configura una estación receptora LoRa y valida las tramas de telemetría de un cohete experimental.",
          location: "Laboratorio de electrónica · Campus de Leganés",
          status: "published",
          shifts: [
            {
              name: "Grupo A",
              startsAt: new Date(Date.UTC(...dayAvionics, 10, 0)),
              endsAt: new Date(Date.UTC(...dayAvionics, 11, 30)),
              capacity: 6,
            },
            {
              name: "Grupo B",
              startsAt: new Date(Date.UTC(...dayAvionics, 16, 0)),
              endsAt: new Date(Date.UTC(...dayAvionics, 17, 30)),
              capacity: 6,
            },
          ],
        },
        admin.profileId,
        db,
      );
      if (!avionics.ok) throw new Error(`Avionics seed failed: ${avionics.error}`);
    }

    const existingOpportunities = await db.select({ slug: opportunities.slug }).from(opportunities);
    if (existingOpportunities.length === 0) {
      const deadline = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 15, 23, 59));
      const opp1 = await createOpportunity(
        {
          slug: "internship-flight-dynamics",
          type: "internship",
          title: "Prácticas en dinámica de vuelo y GNC",
          organization: "GMV Aeroespacial",
          description: "Apoyo al equipo de simulación orbital y algoritmos de guiado y control.",
          requirements: "Estudiantes de 3.º o 4.º de Ingeniería Aeroespacial con conocimientos de MATLAB o Python.",
          location: "Tres Cantos, Madrid",
          modality: "Híbrida",
          deadline,
          applicationUrl: "https://careers.example.com/gmv-flight-dynamics",
          status: "published",
        },
        admin.profileId,
        db,
      );
      if (!opp1.ok) throw new Error(`Opportunity 1 seed failed: ${opp1.error}`);

      const opp2 = await createOpportunity(
        {
          slug: "research-electric-propulsion",
          type: "research",
          title: "Línea de investigación en propulsión eléctrica",
          organization: "Equipo de Propulsión Espacial · UC3M",
          description: "Diagnóstico experimental de propulsores de plasma en cámara de vacío.",
          requirements: "Interés en física de plasmas e instrumentación de laboratorio.",
          location: "Campus de Leganés",
          modality: "Presencial",
          lead: "Prof. Ana Navarro",
          deadline,
          contactEmail: "propulsion.investigacion@uc3m.es",
          infoUrl: "https://ep2.uc3m.es/",
          imageUrl: "https://www.adastrauc3m.es/og-image.png",
          imageAlt: "Cámara de vacío del laboratorio de propulsión eléctrica",
          status: "published",
        },
        admin.profileId,
        db,
      );
      if (!opp2.ok) throw new Error(`Opportunity 2 seed failed: ${opp2.error}`);
    }

    // Ensure at least one shift check succeeded
    const seededShifts = await db.select({ id: shifts.id }).from(shifts);
    if (seededShifts.length < 5 || !student.profileId) {
      throw new Error("E2E seed verification failed.");
    }

    // Clear seed verification codes from the mailbox file so E2E tests start clean.
    if (mailboxFile) {
      rmSync(mailboxFile, { force: true });
    }
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
