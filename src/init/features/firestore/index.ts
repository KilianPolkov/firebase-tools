import { ensureLocationSet } from "../../../ensureCloudResourceLocation";
import { requirePermissions } from "../../../requirePermissions";
import * as rules from "./rules";
import * as indexes from "./indexes";

export async function doSetup(setup: any, config: any): Promise<void> {
  setup.config.firestore = {};

  ensureLocationSet(setup.projectLocation, "Cloud Firestore");
  await requirePermissions({ project: setup.projectId });
  await rules.initRules(setup, config);
  await indexes.initIndexes(setup, config);
}
