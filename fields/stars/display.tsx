import React from "react";
import { FieldContainer, FieldDescription, FieldLabel } from "@keystone-ui/fields";
import { CellLink, CellContainer } from "@keystone-6/core/admin-ui/components";

import {
  type CardValueComponent,
  type CellComponent,
  type FieldController,
  type FieldControllerConfig,
  type FieldProps,
} from "@keystone-6/core/types";
import StarsInterface from "./interface";
import { FieldMeta } from ".";

// this is the component shown in the create modal and item page
export const Field = ({ field, value, onChange, autoFocus }: FieldProps<typeof controller>) => (
  <FieldContainer as="fieldset">
    <FieldLabel as="legend">{field.label}</FieldLabel>
    <FieldDescription id={`${field.path}-description`}>{field.description}</FieldDescription>
    <StarsInterface
      icon={field.meta.icon}
      maxStars={field.meta.maxStars || 5}
      onChange={onChange}
      value={value}
      autoFocus={autoFocus}
    />
  </FieldContainer>
);


// this is shown on the list view in the table
export const Cell: CellComponent = ({ item, field, linkTo }) => {
  let value = item[field.path] + "";
  return linkTo ? <CellLink {...linkTo}>{value}</CellLink> : <CellContainer>{value}</CellContainer>;
};
// setting supportsLinksTo means the cell component allows containing a link to the item
// for example, text fields support it but relationship fields don't because
// their cell component links to the related item so it can't link to the item that the relationship is on
Cell.supportsLinkTo = true;

// this is shown on the item page in relationship fields with `displayMode: 'cards'`
export const CardValue: CardValueComponent = ({ item, field }) => {
  return (
    <FieldContainer>
      <FieldLabel>{field.label}</FieldLabel>
      {item[field.path]}
    </FieldContainer>
  );
};

export const controller = (
  config: FieldControllerConfig<FieldMeta>
): FieldController<number | null, string> & { meta: FieldMeta } => {
  return {
    meta: config.fieldMeta,
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection: config.path,
    defaultValue: null,
    deserialize: (data) => {
      const value = data[config.path];
      return typeof value === "number" ? value : null;
    },
    serialize: (value) => ({ [config.path]: value }),
  };
};
