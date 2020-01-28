import { preventNetworkAccess, restoreNetworkAccess } from './requests';

beforeEach(function() {
  preventNetworkAccess();
});

afterEach(function() {
  restoreNetworkAccess();
});
