import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // next/link 를 직접 쓰면 보이는 링크마다 화면을 미리 받아 Vercel 무료 한도(요청 수)를 깎는다.
  // 미리 불러오기를 끈 AppLink 하나로만 이동 링크를 만든다.
  {
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/components/AppLink.jsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "next/link 대신 @/components/AppLink 를 쓴다 — Link 는 보이는 링크마다 화면을 미리 받아 Vercel 무료 한도(요청 수)를 깎는다.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
