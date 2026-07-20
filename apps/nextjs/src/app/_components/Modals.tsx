"use client";

import NiceModal from "@ebay/nice-modal-react";

import LoginModal from "./LoginModal";

export const Modals = {
  LoginModal: "LoginModal",
} as const;

NiceModal.register(Modals.LoginModal, LoginModal);
