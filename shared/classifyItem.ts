export interface ClassificationInput {
  name: string;
  baseItemName?: string | null;
  categoryCode: string;
  sizeLabel?: string | null;
}

export interface ClassificationResult {
  subcategory: string | null;
  detailType: string | null;
}

export function classifyInventoryItem(params: ClassificationInput): ClassificationResult {
  const base = (params.baseItemName || params.name || '').trim();
  const name = (params.name || '').trim();
  const code = (params.categoryCode || '').toUpperCase();
  const bl = base.toLowerCase();
  const nl = name.toLowerCase();

  // ── Cable Tray (CT) ──────────────────────────────────────────────────────
  if (code === 'CT') {
    if (/cover/i.test(bl)) return { subcategory: 'Covers', detailType: 'Cover' };
    if (/vertical\s+tee|vertical\s+t\b/i.test(bl)) return { subcategory: 'Fittings', detailType: 'Tee' };
    if (/\btee\b/i.test(bl)) return { subcategory: 'Fittings', detailType: 'Tee' };
    if (/cross/i.test(bl)) return { subcategory: 'Fittings', detailType: 'Cross' };
    if (/reducer/i.test(bl)) return { subcategory: 'Fittings', detailType: 'Reducer' };
    if (/horizontal.*elbow|elbow/i.test(bl)) return { subcategory: 'Fittings', detailType: 'Elbow' };
    if (/vertical/i.test(bl)) return { subcategory: 'Fittings', detailType: 'Vertical' };
    if (/box\s*connector|connector/i.test(bl)) return { subcategory: 'Connectors', detailType: 'Connector' };
    if (/straight|cable.*tray/i.test(bl)) return { subcategory: 'Tray', detailType: 'Straight' };
    return { subcategory: 'Fittings', detailType: null };
  }

  // ── Conduit / Fittings (CF) ──────────────────────────────────────────────
  if (code === 'CF') {
    if (/\bstrap\b|\bone.hole|two.hole/i.test(bl)) return { subcategory: 'Supports', detailType: 'Strap' };
    if (/\bsupport\b/i.test(bl)) return { subcategory: 'Supports', detailType: 'Strap' };
    if (/conduit\s*body|pull\s*elbow|conduit\s*lb|conduit\s*[lcxt]\b/i.test(bl)) {
      return { subcategory: 'Conduit Bodies', detailType: 'Body' };
    }
    if (/\bbushing\b|\blocknut\b/i.test(bl)) return { subcategory: 'Fittings', detailType: 'General' };

    const isEMT  = /\bEMT\b/i.test(bl);
    const isRigid = /\bRigid\b|\bRMC\b|\bIMC\b/i.test(bl);
    const isPVC  = /\bPVC\b/i.test(bl);
    const isFlex = /\bFlex\b|\bLiquidtight\b/i.test(bl);

    const isConnector = /\bConnector\b/i.test(bl);
    const isCoupling  = /\bCoupling\b/i.test(bl);
    const isElbow     = /\bElbow\b/i.test(bl);
    const isFitting   = isConnector || isCoupling;

    if (isFlex) {
      const dt = isConnector ? 'Connector' : 'Conduit';
      return { subcategory: 'Flex Conduit', detailType: dt };
    }
    if (isEMT) {
      if (isFitting) return { subcategory: 'Fittings', detailType: 'EMT' };
      return { subcategory: 'EMT Conduit', detailType: isElbow ? 'Elbow' : 'Conduit' };
    }
    if (isRigid) {
      if (isFitting) return { subcategory: 'Fittings', detailType: 'Rigid' };
      return { subcategory: 'RMC/IMC Conduit', detailType: isElbow ? 'Elbow' : 'Conduit' };
    }
    if (isPVC) {
      if (isFitting) return { subcategory: 'Fittings', detailType: 'PVC' };
      return { subcategory: 'PVC Conduit', detailType: 'Conduit' };
    }
  }

  // ── Conduit Supports & Strut System (CS) ─────────────────────────────────
  if (code === 'CS') {
    if (/\bBeam\s*Clamp\b/i.test(bl)) return { subcategory: 'Beam Clamp', detailType: 'Beam Clamp' };
    if (/\bColumn\s*Support\b/i.test(bl)) return { subcategory: 'Strut Channel', detailType: 'Column Support' };
    if (/\bPost\s*Base\b/i.test(bl)) return { subcategory: 'Strut Channel', detailType: 'Post Base' };
    if (/\bCorner\s*Angle\b/i.test(bl)) return { subcategory: 'Strut Channel', detailType: 'Corner Angle' };
    if (/\bJoiner\b/i.test(bl)) return { subcategory: 'Strut Channel', detailType: 'Joiner' };
    if (/\bStrut\s*Channel\b|\bUnistrut\b|\bSlotted\s*Strut\b|\bSolid\s*Strut\b/i.test(bl)) {
      return { subcategory: 'Strut Channel', detailType: 'Unistrut' };
    }
    if (/\bRod\s*Coupling\b/i.test(bl)) return { subcategory: 'Threaded Rod', detailType: 'Rod Coupling' };
    if (/\bThreaded\s*Rod\b/i.test(bl)) return { subcategory: 'Threaded Rod', detailType: 'Threaded Rod' };
    if (/\bConduit\s*Clamp\b/i.test(bl)) return { subcategory: 'Conduit Support', detailType: 'Conduit Clamp' };
    if (/\bPipe\s*Clamp\b/i.test(bl)) return { subcategory: 'Conduit Support', detailType: 'Unistrut Pipe Clamp' };
    if (/One.Hole.*Strap|Strap.*One.Hole/i.test(bl)) return { subcategory: 'Conduit Support', detailType: 'Strap' };
    if (/Two.Hole.*Strap|Strap.*Two.Hole/i.test(bl)) return { subcategory: 'Conduit Support', detailType: 'Strap' };
    if (/\bStrap\b/i.test(bl)) return { subcategory: 'Conduit Support', detailType: 'Strap' };
    if (/\bSpring\s*Nut\b|\bStrut\s*Washer\b/i.test(bl)) return { subcategory: 'Hardware/Accessories', detailType: null };
  }

  return { subcategory: null, detailType: null };
}
