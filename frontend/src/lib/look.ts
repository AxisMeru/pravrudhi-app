// The look-and-feel patch (spec 3e0b13c4bdc8): tonal layers, a soft top glow, layered card shadows and state tints, all from the existing colour tokens. It is OFF by default: with the build
// flag unset no data-look attribute is written and not one rule in globals.css applies, so the live look is unchanged (rollback = unset the flag and rebuild). The flag is NEXT_PUBLIC_LOOK=tonal.
export const LOOK_TONAL = process.env.NEXT_PUBLIC_LOOK === "tonal";
export const LOOK_ATTRIBUTE: "tonal" | undefined = LOOK_TONAL ? "tonal" : undefined;
