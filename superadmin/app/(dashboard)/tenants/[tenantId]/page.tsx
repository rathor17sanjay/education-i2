"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { adminFetch } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tenant = { id: string; slug: string; name: string; status: string; plan_tier: string };
type Doc = {
  id: string;
  title: string | null;
  content_type: string;
  source_type: string;
  status: string;
};
type SourceKind = "pdf" | "docx" | "pptx" | "text";

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [documents, setDocuments] = useState<Doc[] | null>(null);

  const [sourceKind, setSourceKind] = useState<SourceKind>("pdf");
  const [title, setTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadTenant() {
    adminFetch(`/superadmin/tenants/${tenantId}`)
      .then((res) => res.json())
      .then(setTenant)
      .catch(() => toast.error("Could not load tenant."));
  }

  function loadDocuments() {
    adminFetch(`/superadmin/tenants/${tenantId}/documents`)
      .then((res) => res.json())
      .then(setDocuments)
      .catch(() => toast.error("Could not load documents."));
  }

  useEffect(() => {
    loadTenant();
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function pollJob(jobId: string) {
    const res = await adminFetch(`/superadmin/tenants/${tenantId}/uploads/${jobId}`);
    const job = await res.json();
    setJobStatus(job.status);

    if (job.status === "done") {
      toast.success("Document ingested.");
      loadDocuments();
      return;
    }
    if (job.status === "failed") {
      toast.error(job.error_message || "Ingestion failed.");
      return;
    }
    setTimeout(() => pollJob(jobId), 2000);
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    setJobStatus(null);

    const form = new FormData();
    form.set("title", title);
    form.set("source_kind", sourceKind);
    form.set("auto_approve", String(autoApprove));
    if (sourceKind === "text") {
      form.set("pasted_text", pastedText);
    } else if (fileInputRef.current?.files?.[0]) {
      form.set("file", fileInputRef.current.files[0]);
    } else {
      toast.error("Choose a file first.");
      setUploading(false);
      return;
    }

    const res = await adminFetch(`/superadmin/tenants/${tenantId}/uploads`, {
      method: "POST",
      body: form,
    });

    setUploading(false);
    if (!res.ok) {
      toast.error("Could not start upload.");
      return;
    }

    const { job_id } = await res.json();
    setTitle("");
    setPastedText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    pollJob(job_id);
  }

  return (
    <div className="space-y-6">
      {tenant ? (
        <div>
          <h1 className="font-display text-2xl font-semibold">{tenant.name}</h1>
          <p className="text-muted-foreground text-sm">
            {tenant.slug} · <Badge variant="secondary">{tenant.status}</Badge>
          </p>
        </div>
      ) : (
        <Skeleton className="h-10 w-64" />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add content</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitUpload} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source type</Label>
                <Select value={sourceKind} onValueChange={(v) => setSourceKind(v as SourceKind)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="docx">Word (.docx)</SelectItem>
                    <SelectItem value="pptx">PowerPoint (.pptx)</SelectItem>
                    <SelectItem value="text">Pasted text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="B.Tech CSE brochure"
                />
              </div>
            </div>

            {sourceKind === "text" ? (
              <div className="space-y-2">
                <Label htmlFor="pasted-text">Content</Label>
                <Textarea
                  id="pasted-text"
                  required
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  accept={
                    sourceKind === "pdf"
                      ? ".pdf"
                      : sourceKind === "docx"
                        ? ".docx"
                        : ".pptx"
                  }
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
              />
              Auto-approve (skip review, go live immediately)
            </label>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </Button>
              {jobStatus && jobStatus !== "done" && jobStatus !== "failed" && (
                <span className="text-muted-foreground text-sm">Status: {jobStatus}...</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-display text-lg font-semibold mb-3">Documents</h2>
        {!documents && <Skeleton className="h-32 w-full" />}
        {documents && documents.length === 0 && (
          <p className="text-muted-foreground text-sm">No documents yet.</p>
        )}
        {documents && documents.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title || "(untitled)"}</TableCell>
                  <TableCell className="text-muted-foreground">{doc.content_type}</TableCell>
                  <TableCell>
                    <Badge variant={doc.status === "approved" ? "default" : "secondary"}>
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {doc.status !== "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await adminFetch(
                            `/superadmin/tenants/${tenantId}/documents/${doc.id}/approve`,
                            { method: "POST" },
                          );
                          toast.success("Approved.");
                          loadDocuments();
                        }}
                      >
                        Approve
                      </Button>
                    )}
                    {doc.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await adminFetch(
                            `/superadmin/tenants/${tenantId}/documents/${doc.id}/archive`,
                            { method: "POST" },
                          );
                          toast.success("Archived.");
                          loadDocuments();
                        }}
                      >
                        Archive
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
