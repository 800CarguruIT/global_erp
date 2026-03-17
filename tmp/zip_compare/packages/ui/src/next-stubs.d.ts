declare module "next/link" {
  import * as React from "react";
  const Link: React.FC<any>;
  export default Link;
}

declare module "next/navigation" {
  export function usePathname(): string;
  export function useRouter(): { push: (href: string) => void; replace?: (href: string) => void };
  export function useParams<T extends Record<string, string>>(): T;
}
