import { db, type Category, type Organization } from "./db";

const DEFAULT_ORGS: Omit<Organization, "id">[] = [
  { name: "Bishopric", order: 1, active: true },
  { name: "Elders Quorum", order: 2, active: true },
  { name: "Relief Society", order: 3, active: true },
  { name: "Young Men", order: 4, active: true },
  { name: "Young Women", order: 5, active: true },
  { name: "Primary", order: 6, active: true },
  { name: "Sunday School", order: 7, active: true },
  { name: "Ward Activities", order: 8, active: true },
  { name: "Music", order: 9, active: true },
  { name: "Other / Miscellaneous", order: 10, active: true },
];

const DEFAULT_CATEGORIES: Omit<Category, "id" | "organizationId">[] = [
  { name: "Activities", active: true },
  { name: "Supplies", active: true },
  { name: "Materials / Manuals", active: true },
  { name: "Food", active: true },
  { name: "Service Projects", active: true },
  { name: "Camps & Youth Conferences", active: true },
  { name: "Quorum / Class Activities", active: true },
  { name: "Ministering", active: true },
  { name: "Quarterly Allotment", active: true },
  { name: "Inter-Ward Transfer", active: true },
  { name: "Refund / Reimbursement", active: true },
  { name: "Other", active: true },
];

export async function seedIfEmpty(): Promise<void> {
  const orgCount = await db.organizations.count();
  if (orgCount === 0) {
    await db.organizations.bulkAdd(DEFAULT_ORGS);
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, organizationId: null })),
    );
  }

  const settings = await db.settings.get("initialized");
  if (!settings) {
    await db.settings.put({ key: "initialized", value: true });
    await db.settings.put({ key: "currency", value: "PHP" });
    await db.settings.put({ key: "wardName", value: "" });
  }
}
