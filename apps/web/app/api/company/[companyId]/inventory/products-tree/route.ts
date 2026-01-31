import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type ProductTreeRow = {
  make_id: string | null;
  make_name: string | null;
  model_id: string | null;
  model_name: string | null;
  year_id: string | null;
  year: number | null;
  subcategory_name: string | null;
  category_name: string | null;
  type_name: string | null;
};

type YearNode = {
  id: string;
  year: number | null;
};

type ModelNode = {
  id: string;
  name: string;
  years: YearNode[];
};

type MakeTaxonomy = {
  inventoryTypeName?: string | null;
  categoryName?: string | null;
  subcategoryName?: string | null;
};

type MakeNode = {
  id: string;
  name: string;
  taxonomy: MakeTaxonomy;
  models: ModelNode[];
};

type ProductTreeResponse = MakeNode[];

export async function GET(_req: NextRequest) {
  const sql = getSql();
  const rows: ProductTreeRow[] = await sql/* sql */ `
    SELECT
      mk.id AS make_id,
      mk.name AS make_name,
      mdl.id AS model_id,
      mdl.name AS model_name,
      yr.id AS year_id,
      yr.year AS year,
      sc.name AS subcategory_name,
      c.name AS category_name,
      t.name AS type_name
    FROM inventory_car_makes mk
    JOIN inventory_car_models mdl
      ON mdl.make_id = mk.id
      AND mdl.company_id IS NULL
    LEFT JOIN inventory_model_years yr
      ON yr.model_id = mdl.id
      AND yr.company_id IS NULL
    LEFT JOIN inventory_subcategories sc
      ON sc.id = mk.subcategory_id
      AND sc.company_id IS NULL
    LEFT JOIN inventory_categories c
      ON c.id = sc.category_id
      AND c.company_id IS NULL
    LEFT JOIN inventory_types t
      ON t.id = c.inventory_type_id
      AND t.company_id IS NULL
    WHERE mk.company_id IS NULL
      AND (mk.is_active IS TRUE OR mk.is_active IS NULL)
      AND (mdl.is_active IS TRUE OR mdl.is_active IS NULL)
    ORDER BY mk.name ASC, mdl.name ASC, yr.year DESC NULLS LAST
  `;

  const tree = buildProductTree(rows);
  return NextResponse.json({ data: tree });
}

function buildProductTree(rows: ProductTreeRow[]): ProductTreeResponse {
  type MakeAccumulator = {
    node: MakeNode;
    models: Map<string, { node: ModelNode; yearIds: Set<string> }>;
  };

  const makes = new Map<string, MakeAccumulator>();

  for (const row of rows) {
    if (!row.make_id) {
      continue;
    }

    let makeEntry = makes.get(row.make_id);
    if (!makeEntry) {
      makeEntry = {
        node: {
          id: row.make_id,
          name: row.make_name ?? "Unknown make",
          taxonomy: {
            inventoryTypeName: row.type_name,
            categoryName: row.category_name,
            subcategoryName: row.subcategory_name,
          },
          models: [],
        },
        models: new Map(),
      };
      makes.set(row.make_id, makeEntry);
    }

    if (!row.model_id) {
      continue;
    }

    let modelEntry = makeEntry.models.get(row.model_id);
    if (!modelEntry) {
      const node: ModelNode = {
        id: row.model_id,
        name: row.model_name ?? "Unknown model",
        years: [],
      };

      modelEntry = {
        node,
        yearIds: new Set(),
      };

      makeEntry.models.set(row.model_id, modelEntry);
      makeEntry.node.models.push(node);
    }

    if (row.year_id && row.year !== null && !modelEntry.yearIds.has(row.year_id)) {
      modelEntry.yearIds.add(row.year_id);
      modelEntry.node.years.push({
        id: row.year_id,
        year: row.year,
      });
    }
  }

  return Array.from(makes.values()).map((entry) => entry.node);
}
