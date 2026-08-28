"use client";

import { ImagePlus, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { createOrg } from "~/actions/orgs";
import { getPresignedUploadUrl } from "~/actions/upload";
import { Field, fieldControlProps } from "~/components/common/field";
import { FilterChip } from "~/components/common/filter-chip";
import { Panel } from "~/components/common/panel";
import { PageHeading, PageShell } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

const ORG_CATEGORIES = [
  { id: "career", label: "Career" },
  { id: "affinity", label: "Affinity" },
  { id: "performing arts", label: "Performing Arts" },
  { id: "academics", label: "Academics" },
  { id: "athletics", label: "Athletics" },
  { id: "social event", label: "Social" },
  { id: "culture", label: "Culture" },
  { id: "religion", label: "Religion" },
  { id: "politics", label: "Politics" },
  { id: "community service", label: "Service" },
];

export default function CreateOrgPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleLogoUpload = useCallback(
    async (file: File) => {
      if (isUploading) return;
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onload = (e) => setLogoPreview(e.target?.result as string);
        reader.readAsDataURL(file);

        const { uploadUrl, publicUrl } = await getPresignedUploadUrl({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder: "org-logos",
        });

        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        setLogoUrl(publicUrl);
      } catch (err) {
        console.error("Upload failed:", err);
        setLogoPreview(null);
      } finally {
        setIsUploading(false);
      }
    },
    [isUploading],
  );

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!description.trim()) newErrors.description = "Description is required";
    if (!category) newErrors.category = "Select a category";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    startTransition(async () => {
      try {
        const result = await createOrg({
          name: name.trim(),
          description: description.trim(),
          category,
          logoUrl: logoUrl ?? undefined,
        });
        router.push(`/orgs/${result.id}`);
      } catch (err) {
        if (err instanceof Error && err.message.includes("org leaders")) {
          setErrors({
            name: "Only org leaders can create organizations. Update this in Settings.",
          });
        }
      }
    });
  };

  return (
    <PageShell width="narrow">
      <PageHeading description="Set up your student group on The Forum.">
        Create Organization
      </PageHeading>

      <Panel size="lg" className="space-y-8">
        {/* Logo */}
        <div className="flex items-center gap-6">
          {logoPreview ? (
            <div className="relative">
              <img src={logoPreview} alt="" className="size-20 rounded-xl object-cover" />
              <Button
                variant="solid"
                size="icon-xs"
                aria-label="Remove logo"
                onClick={() => {
                  setLogoPreview(null);
                  setLogoUrl(null);
                }}
                className="absolute -right-1.5 -top-1.5 rounded-full"
              >
                <X />
              </Button>
              {isUploading && (
                <output className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
                  <span className="sr-only">Uploading logo…</span>
                  <Upload size={14} aria-hidden className="animate-bounce text-forum-dark-gray" />
                </output>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group flex size-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-forum-border transition-colors hover:border-forum-cerulean focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-cerulean"
            >
              <span className="sr-only">Upload organization logo</span>
              <ImagePlus
                size={20}
                aria-hidden
                className="text-forum-light-gray transition-colors group-hover:text-forum-cerulean"
              />
            </button>
          )}
          <div>
            <p className="font-dm-sans text-sm font-semibold text-black">Organization Logo</p>
            <p className="mt-0.5 font-dm-sans text-xs text-forum-light-gray">
              Optional. JPEG, PNG, or WebP.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
            }}
          />
        </div>

        <Field id="name" label="Organization Name" error={errors.name} required>
          <Input
            {...fieldControlProps("name", errors.name)}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
            }}
            placeholder="e.g. Princeton Entrepreneurship Club"
            className={cn("h-12 text-base", errors.name && "border-forum-coral")}
          />
        </Field>

        <Field id="desc" label="Description" error={errors.description} required>
          <Textarea
            {...fieldControlProps("desc", errors.description)}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors((prev) => ({ ...prev, description: "" }));
            }}
            placeholder="What does your organization do?"
            rows={4}
            className={cn("resize-none text-base", errors.description && "border-forum-coral")}
          />
        </Field>

        {/* Category */}
        <fieldset>
          <Label asChild>
            <legend className="mb-3 font-dm-sans text-sm font-semibold text-black">
              Category<span className="text-forum-coral">*</span>
            </legend>
          </Label>
          <div className="flex flex-wrap gap-2">
            {ORG_CATEGORIES.map(({ id, label }) => (
              <FilterChip
                key={id}
                active={category === id}
                onClick={() => {
                  setCategory(id);
                  if (errors.category) setErrors((prev) => ({ ...prev, category: "" }));
                }}
              >
                {label}
              </FilterChip>
            ))}
          </div>
          {errors.category && (
            <p className="mt-2 font-dm-sans text-xs text-forum-coral">{errors.category}</p>
          )}
        </fieldset>
      </Panel>

      <div className="mt-8 flex items-center justify-end gap-3">
        <Button variant="quiet" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button variant="cerulean" size="cta" onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Creating…" : "Create Organization"}
        </Button>
      </div>
    </PageShell>
  );
}
