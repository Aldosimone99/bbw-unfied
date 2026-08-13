import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/__tests__/canonical/**/*.test.ts',
      'src/__tests__/db/foundation-schema.test.ts',
      'src/__tests__/routes/foundation-app-routes.test.ts',
      'src/__tests__/routes/organization-members-routes.test.ts',
      'src/__tests__/services/company-invite-service.test.ts',
      'src/__tests__/services/organization-members-service.test.ts',
    ],
    exclude: ['node_modules', 'dist'],
  },
});
