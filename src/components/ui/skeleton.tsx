import { cn } from "@/lib/utils";

// shadcn 기본값은 `bg-accent`지만 이 프로젝트의 `--accent`는 브랜드 옐로(CTA 색)라
// skeleton이 강조 요소처럼 보인다. 중립 회색인 `--muted`를 쓴다.

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
