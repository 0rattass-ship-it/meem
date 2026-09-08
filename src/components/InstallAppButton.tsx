import { useEffect, useState } from "react";
import { Share, Plus, Smartphone, MoreVertical, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "android" | "ios" | "desktop";

function detectPlatform(): Platform {
  const ua = window.navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function InstallAppButton() {
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(Boolean(standalone));
    setReady(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ready || installed) return null;

  const handleClick = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        size="sm"
        variant="secondary"
        className="shrink-0 rounded-full font-bold"
      >
        <Download className="size-4" />
        📲 تثبيت التطبيق
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-primary">📲 تثبيت التطبيق</DialogTitle>
            <DialogDescription>
              أضف المتجر إلى شاشة جهازك الرئيسية ليعمل كتطبيق مستقل.
            </DialogDescription>
          </DialogHeader>

          {platform === "ios" ? (
            <ol className="space-y-3 text-sm">
              <Step icon={<Share className="size-4" />}>
                افتح المتجر في متصفح <strong>Safari</strong> ثم اضغط زر المشاركة في أسفل الشاشة.
              </Step>
              <Step icon={<Plus className="size-4" />}>
                اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
              </Step>
              <Step icon={<Smartphone className="size-4" />}>
                اضغط <strong>«إضافة»</strong>، وستجد أيقونة المتجر على شاشتك.
              </Step>
            </ol>
          ) : platform === "android" ? (
            <ol className="space-y-3 text-sm">
              <Step icon={<MoreVertical className="size-4" />}>
                اضغط زر القائمة (⋮) أعلى متصفح <strong>Chrome</strong>.
              </Step>
              <Step icon={<Plus className="size-4" />}>
                اختر <strong>«تثبيت التطبيق»</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
              </Step>
              <Step icon={<Smartphone className="size-4" />}>
                أكِّد التثبيت، وسيظهر المتجر كتطبيق مستقل.
              </Step>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <Step icon={<Download className="size-4" />}>
                اضغط أيقونة التثبيت في شريط عنوان المتصفح (Chrome أو Edge).
              </Step>
              <Step icon={<Plus className="size-4" />}>
                أو من قائمة المتصفح اختر <strong>«تثبيت»</strong>.
              </Step>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {icon}
      </span>
      <span className="flex-1 leading-relaxed text-foreground">{children}</span>
    </li>
  );
}
