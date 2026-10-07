CREATE TABLE "project_secrets" (
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_secrets_project_id_name_pk" PRIMARY KEY("project_id","name")
);
--> statement-breakpoint
CREATE TABLE "shared_rows" (
	"project_id" text NOT NULL,
	"table_id" text NOT NULL,
	"row_id" text NOT NULL,
	"values" jsonb NOT NULL,
	"seq" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_rows_project_id_table_id_row_id_pk" PRIMARY KEY("project_id","table_id","row_id")
);
--> statement-breakpoint
CREATE TABLE "shared_vars" (
	"project_id" text NOT NULL,
	"var_id" text NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_vars_project_id_var_id_pk" PRIMARY KEY("project_id","var_id")
);
--> statement-breakpoint
ALTER TABLE "project_secrets" ADD CONSTRAINT "project_secrets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_rows" ADD CONSTRAINT "shared_rows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_vars" ADD CONSTRAINT "shared_vars_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_rows_order_idx" ON "shared_rows" USING btree ("project_id","table_id","seq");