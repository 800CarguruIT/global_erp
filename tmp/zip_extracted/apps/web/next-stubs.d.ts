declare module "next/navigation" {
  export function useRouter(): { push: (href: string) => void; replace?: (href: string) => void };
  export function usePathname(): string;
  export function useParams<T extends Record<string, string>>(): T;
}
