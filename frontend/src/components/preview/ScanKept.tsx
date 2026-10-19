"use client";

import { createContext, useContext } from "react";

/** The user's own uploads kept in this browser (flag-ON only), by the paper name the engine knows them by, so a quote row can show its page-image crop. Empty by default: flag OFF renders nothing extra. */
export const KeptUploads = createContext<ReadonlyMap<string, File>>(new Map());
export const useKept = (): ReadonlyMap<string, File> => useContext(KeptUploads);
