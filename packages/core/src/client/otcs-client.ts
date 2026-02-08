// Import all domain augmentations (order matters - auth first)
import './auth';
import './navigation';
import './nodes';
import './folders';
import './documents';
import './search';
import './workflows';
import './workspaces';
import './categories';
import './members';
import './permissions';
import './sharing';
import './rm-classification';
import './rm-holds';
import './rm-xref';
import './rm-rsi';

// Re-export the augmented class
export { OTCSClient } from './base';
