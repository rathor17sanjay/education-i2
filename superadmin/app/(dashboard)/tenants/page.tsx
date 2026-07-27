"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, FileText, Pencil, Search } from "lucide-react";
import { adminFetch } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SeoFieldKey =
  | "seo_title"
  | "meta_description"
  | "canonical_url"
  | "robots"
  | "schema_type"
  | "social_metadata"
  | "author"
  | "reviewer";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan_tier: string;
  website_url: string | null;
  logo_url: string | null;
  icon_url: string | null;
  brand_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  gtm_id: string | null;
} & Partial<Record<SeoFieldKey, string | null>>;

const SLUG_EDITABLE_STATUSES = ["trial"];

type SeoField = {
  key: SeoFieldKey;
  label: string;
  hint?: string;
  multiline?: boolean;
  type?: string;
};

// Per-tenant search-optimization defaults. Only fields that genuinely
// describe the whole tenant live here (SEO metadata + author/reviewer trust
// signals) -- the rest of AEO/GEO (short answer, FAQs, sources, AI summary,
// etc.) describes one specific generated page, not the tenant, so a single
// static value here couldn't represent it. Those get auto-derived per
// /ai/q/{slug} page from the AI's own output instead of captured here.
const SEO_SECTIONS: { title: string; fields: SeoField[] }[] = [
  {
    title: "SEO",
    fields: [
      { key: "seo_title", label: "SEO Title" },
      { key: "meta_description", label: "Meta Description", multiline: true },
      { key: "canonical_url", label: "Canonical URL" },
      { key: "robots", label: "Robots", hint: "e.g. index, follow" },
      { key: "schema_type", label: "Schema Type", hint: "e.g. EducationalOrganization" },
      { key: "social_metadata", label: "Social Metadata", multiline: true, hint: "OG title/description/image" },
    ],
  },
  {
    title: "Authorship",
    fields: [
      { key: "author", label: "Author", hint: "trust signal for generative engines" },
      { key: "reviewer", label: "Reviewer" },
    ],
  },
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
        />
        <Input
          placeholder="#e83c44"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function AssetUploadField({
  label,
  hint,
  url,
  onUpload,
}: {
  label: string;
  hint: string;
  url: string;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label>
        {label} <span className="text-muted-foreground">({hint})</span>
      </Label>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-input bg-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} className="h-full w-full object-contain" />
          ) : (
            <span className="text-muted-foreground text-xs">None</span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {url ? "Replace" : "Upload"}
        </Button>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<Tenant | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editIconUrl, setEditIconUrl] = useState("");
  const [editBrandName, setEditBrandName] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("");
  const [editSecondaryColor, setEditSecondaryColor] = useState("");
  const [editGtmId, setEditGtmId] = useState("");
  const [saving, setSaving] = useState(false);

  const [seoTenant, setSeoTenant] = useState<Tenant | null>(null);
  const [seoForm, setSeoForm] = useState<Record<string, string>>({});
  const [savingSeo, setSavingSeo] = useState(false);

  const slugLocked = !!editing && !SLUG_EDITABLE_STATUSES.includes(editing.status);

  function loadTenants() {
    adminFetch("/superadmin/tenants")
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        setTenants(await res.json());
      })
      .catch(() => setError("Could not load tenants."));
  }

  useEffect(loadTenants, []);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const res = await adminFetch("/superadmin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name, website_url: websiteUrl || null }),
    });

    setCreating(false);

    if (res.status === 409) {
      toast.error(`Slug "${slug}" is already taken.`);
      return;
    }
    if (!res.ok) {
      toast.error("Could not create tenant.");
      return;
    }

    toast.success(`${name} created.`);
    setCreateOpen(false);
    setSlug("");
    setName("");
    setWebsiteUrl("");
    loadTenants();
  }

  function openEdit(t: Tenant) {
    setEditing(t);
    setEditSlug(t.slug);
    setEditName(t.name);
    setEditStatus(t.status);
    setEditWebsiteUrl(t.website_url ?? "");
    setEditLogoUrl(t.logo_url ?? "");
    setEditIconUrl(t.icon_url ?? "");
    setEditBrandName(t.brand_name ?? "");
    setEditPrimaryColor(t.primary_color ?? "");
    setEditSecondaryColor(t.secondary_color ?? "");
    setEditGtmId(t.gtm_id ?? "");
  }

  async function uploadAsset(kind: "logo" | "icon", file: File) {
    if (!editing) return;

    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);

    const res = await adminFetch(`/superadmin/tenants/${editing.id}/assets`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      toast.error(`Could not upload ${kind}.`);
      return;
    }

    const updated: Tenant = await res.json();
    if (kind === "logo") setEditLogoUrl(updated.logo_url ?? "");
    else setEditIconUrl(updated.icon_url ?? "");
    toast.success(`${kind === "logo" ? "Logo" : "Icon"} uploaded.`);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);

    const res = await adminFetch(`/superadmin/tenants/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slugLocked ? undefined : editSlug,
        name: editName,
        status: editStatus,
        website_url: editWebsiteUrl || null,
        logo_url: editLogoUrl || null,
        icon_url: editIconUrl || null,
        brand_name: editBrandName || null,
        primary_color: editPrimaryColor || null,
        secondary_color: editSecondaryColor || null,
        gtm_id: editGtmId || null,
      }),
    });

    setSaving(false);
    if (res.status === 400) {
      const body = await res.json();
      toast.error(body.detail || "Could not update tenant.");
      return;
    }
    if (!res.ok) {
      toast.error("Could not update tenant.");
      return;
    }

    toast.success("Profile updated.");
    setEditing(null);
    loadTenants();
  }

  function openSeo(t: Tenant) {
    setSeoTenant(t);
    const initial: Record<string, string> = {};
    for (const section of SEO_SECTIONS) {
      for (const f of section.fields) {
        initial[f.key] = t[f.key] ?? "";
      }
    }
    setSeoForm(initial);
  }

  async function saveSeo(e: React.FormEvent) {
    e.preventDefault();
    if (!seoTenant) return;
    setSavingSeo(true);

    const res = await adminFetch(`/superadmin/tenants/${seoTenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seoForm),
    });

    setSavingSeo(false);
    if (!res.ok) {
      toast.error("Could not save search optimization settings.");
      return;
    }

    toast.success("Search optimization settings saved.");
    setSeoTenant(null);
    loadTenants();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Tenants</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>New tenant</DialogTrigger>
          <DialogContent>
            <form onSubmit={createTenant}>
              <DialogHeader>
                <DialogTitle>Create a new tenant</DialogTitle>
                <DialogDescription>
                  Onboards a new university. You can upload its content afterward.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="university"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="University Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website_url">Website (optional)</Label>
                  <Input
                    id="website_url"
                    placeholder="https://www.university.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create tenant"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!tenants && !error && <Skeleton className="h-40 w-full" />}

      {tenants && tenants.length === 0 && (
        <p className="text-muted-foreground text-sm">No tenants yet. Create the first one.</p>
      )}

      {tenants && tenants.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{t.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.plan_tier}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit university profile"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="View documents"
                    onClick={() => router.push(`/tenants/${t.id}`)}
                  >
                    <FileText />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Open university website"
                    disabled={!t.website_url}
                    onClick={() => t.website_url && window.open(t.website_url, "_blank")}
                  >
                    <ExternalLink />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Search optimization"
                    onClick={() => openSeo(t)}
                  >
                    <Search />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={saveEdit}>
            <DialogHeader>
              <DialogTitle>University profile</DialogTitle>
              <DialogDescription>Branding used on {editing?.name}&apos;s own site.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-slug">
                  Slug <span className="text-muted-foreground">(used in API calls)</span>
                </Label>
                <Input
                  id="edit-slug"
                  required
                  disabled={slugLocked}
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                />
                {slugLocked && (
                  <p className="text-xs text-muted-foreground">
                    Locked -- tenant is {editing?.status}, not trial. Changing it now would break
                    any live requests already pointed at the current slug.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-website">
                  Website <span className="text-muted-foreground">(for reference while sourcing content)</span>
                </Label>
                <Input
                  id="edit-website"
                  placeholder="https://www.university.com"
                  value={editWebsiteUrl}
                  onChange={(e) => setEditWebsiteUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="past_due">Past due</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-brand-name">
                  Brand name <span className="text-muted-foreground">(e.g. &ldquo;Ask UNIVERSITY AI&rdquo;)</span>
                </Label>
                <Input
                  id="edit-brand-name"
                  placeholder="UNIVERSITY"
                  value={editBrandName}
                  onChange={(e) => setEditBrandName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <AssetUploadField
                  label="Main logo"
                  hint="header + loader"
                  url={editLogoUrl}
                  onUpload={(file) => uploadAsset("logo", file)}
                />
                <AssetUploadField
                  label="Small icon"
                  hint="search box"
                  url={editIconUrl}
                  onUpload={(file) => uploadAsset("icon", file)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <ColorField label="Primary color" value={editPrimaryColor} onChange={setEditPrimaryColor} />
                <ColorField label="Secondary color" value={editSecondaryColor} onChange={setEditSecondaryColor} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-gtm-id">
                  Google Tag Manager ID <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="edit-gtm-id"
                  placeholder="GTM-XXXXXXX"
                  value={editGtmId}
                  onChange={(e) => setEditGtmId(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!seoTenant} onOpenChange={(v) => !v && setSeoTenant(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <form onSubmit={saveSeo} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>Search optimization</SheetTitle>
              <SheetDescription>
                {seoTenant?.name} -- SEO metadata and authorship defaults for generated pages.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-6 px-4">
              {SEO_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-4">
                  <h3 className="font-display text-sm font-semibold text-muted-foreground">
                    {section.title}
                  </h3>
                  {section.fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`seo-${field.key}`}>
                        {field.label}
                        {field.hint && (
                          <span className="text-muted-foreground"> ({field.hint})</span>
                        )}
                      </Label>
                      {field.multiline ? (
                        <Textarea
                          id={`seo-${field.key}`}
                          rows={3}
                          value={seoForm[field.key] ?? ""}
                          onChange={(e) =>
                            setSeoForm((f) => ({ ...f, [field.key]: e.target.value }))
                          }
                        />
                      ) : (
                        <Input
                          id={`seo-${field.key}`}
                          type={field.type ?? "text"}
                          value={seoForm[field.key] ?? ""}
                          onChange={(e) =>
                            setSeoForm((f) => ({ ...f, [field.key]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <SheetFooter>
              <SheetClose render={<Button variant="outline" type="button" />}>Cancel</SheetClose>
              <Button type="submit" disabled={savingSeo}>
                {savingSeo ? "Saving..." : "Save"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
