import { flatRoutes } from "@react-router/fs-routes";

// Every other file under app/routes becomes a route. A test file registered
// as one pulls the test runner into the server build and fails every request.
export default flatRoutes({
  ignoredRouteFiles: ["**/*.test.{ts,tsx}"],
});
