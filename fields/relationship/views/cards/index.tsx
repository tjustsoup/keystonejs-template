/** @jsxRuntime classic */
/** @jsx jsx */

import "./styles.css";
import { Stack, Text, jsx } from "@keystone-ui/core";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Button } from "@keystone-ui/button";
import { LoadingDots } from "@keystone-ui/loading";
import { useEffect, useRef, useState } from "react";
import { getGqlNames, type ListMeta } from "@keystone-6/core/types";
import { ApolloClient, InMemoryCache } from "@keystone-6/core/admin-ui/apollo";
import { Items, useItemState } from "./useItemState";
import { InlineCreate } from "./InlineCreate";
import CardContainer from "./CardContainers/CardContainer";
import ListItemCardContainer from "./CardContainers/ListItemCardContainer";
import EditCardContainer from "./CardContainers/EditCardContainer";
import { DataGetter } from "@keystone-6/core/admin-ui/utils";
import { useKeystone } from "@keystone-6/core/admin-ui/context";
import { fetchGraphQLClient } from "../../../../admin/utils";
import { WrapperProps } from "../../wrapper";

type ItemObject = {
  itemGetter: DataGetter<{
    [key: string]: any;
    id: string;
  }>;
  id: string;
};

export type BaseCardContainerProps = {
  field: any;
  foreignList: ListMeta;
  items: Items;
  onChange?: (val: any) => void;
  selectedFields: string;
  setItems: (items: Items) => void;
  value: any;
};

export function Cards({
  localList,
  field,
  foreignList,
  id,
  value,
  onChange,
  forceValidation,
}: {
  foreignList: ListMeta;
  localList: ListMeta;
} & WrapperProps) {
  /* selectedFields */
  const { displayOptions } = value;
  let selectedFields = [
    ...new Set([
      ...displayOptions.cardFields,
      ...(displayOptions.inlineEdit?.fields || []),
    ]),
  ]
    .map((fieldPath) => {
      return foreignList.fields[fieldPath].controller.graphqlSelection;
    })
    .join("\n");
  if (!displayOptions.cardFields.includes("id")) {
    selectedFields += "\nid";
  }
  if (
    !displayOptions.cardFields.includes(foreignList.labelField) &&
    foreignList.labelField !== "id"
  ) {
    selectedFields += `\n${foreignList.labelField}`;
  }

  /* Constants + States */
  const {
    items,
    setItems,
    state: itemsState,
  } = useItemState({
    selectedFields,
    localList,
    foreignList,
    id,
    field
  });
  const client = new ApolloClient({
    uri:
      process.env.APOLLO_CLIENT_GRAPHQL_URI ||
      "http://localhost:3000/api/graphql",
    cache: new InMemoryCache(),
  });
  const [isLoadingLazyItems, setIsLoadingLazyItems] = useState(false);
  const [showConnectItems, setShowConnectItems] = useState(false);
  const [hideConnectItemsLabel, setHideConnectItemsLabel] = useState<
    "Cancel" | "Done"
  >("Cancel");
  const editRef = useRef<HTMLDivElement | null>(null);
  // Query
  const keystone = useKeystone();
  const fetchGraphQL = fetchGraphQLClient(keystone.apiPath);
  const gqlNames = getGqlNames({
    listKey: field.refListKey,
    pluralGraphQLName: keystone.adminMeta.lists[
      field.refListKey
    ].plural.replace(" ", ""),
  });

  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  });
  useEffect(() => {
    if (value.itemsBeingEdited) {
      editRef?.current?.focus();
    }
  }, [value]);

  /* Cards Ordering */
  const [cardsOrder, setCardsOrder] = useState<ItemObject[]>([]);
  function handleDragEnd(result) {
    if (!result.destination) return;
    const itemsCopy = Array.from(cardsOrder);
    const [reorderedItem] = itemsCopy.splice(result.source.index, 1);
    itemsCopy.splice(result.destination.index, 0, reorderedItem);

    // Update state with reordered items...
    setCardsOrder(itemsCopy);
    handleReorderQuery(itemsCopy, cardsOrder);
  }
  useEffect(() => {
    if (value.currentIds && items) {
      const currentIdsArrayWithFetchedItems = [...value.currentIds]
        .map((id) => ({ itemGetter: items[id], id }))
        .filter((x) => x.itemGetter)
        .sort((a, b) => {
          if (a.itemGetter.data.sort < b.itemGetter.data.sort) {
            return -1;
          } else if (a.itemGetter.data.sort > b.itemGetter.data.sort) {
            return 1;
          } else {
            return 0;
          }
        });
      setCardsOrder(currentIdsArrayWithFetchedItems);
    }
  }, [value.currentIds, items]);

  /* Handle Reorder Query */
  async function handleReorderQuery(
    newSort: ItemObject[],
    fallback: ItemObject[]
  ) {
    const sortData = newSort
      .map((v, i) => {
        if (v.itemGetter.data.sort !== i) {
          return {
            data: {
              sort: i,
            },
            where: {
              id: v.id,
            },
          };
        } else {
          return null;
        }
      })
      .filter((v) => v !== null);
    fetchGraphQL(
      `
    mutation($data: [${gqlNames.updateManyInputName}!]!) {
      ${gqlNames.updateManyMutationName}(data: $data) {
        id
      }
    }
  `,
      { data: sortData }
    )
      .then((e) => {
        // console.log(e);
      })
      .catch(() => setCardsOrder(fallback));
  }

  if (itemsState.kind === "loading") {
    return (
      <div>
        <LoadingDots label={`Loading items for ${field.label} field`} />
      </div>
    );
  }
  if (itemsState.kind === "error") {
    return <span css={{ color: "red" }}>{itemsState.message}</span>;
  }

  const BaseCardContainerProps = {
    field,
    foreignList,
    items,
    onChange,
    selectedFields,
    setItems,
    value,
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Stack gap="medium">
        {cardsOrder.length !== 0 && (
          <Droppable droppableId="cards">
            {(provided) => (
              <ol
                {...provided.droppableProps}
                ref={provided.innerRef}
                // style={{ listStyle: "none", padding: 0 }}
              >
                {cardsOrder.map(({ id, itemGetter }, index) => {
                  const isEditMode =
                    !!(onChange !== undefined) &&
                    value.itemsBeingEdited.has(id);
                  return (
                    <Draggable key={id} draggableId={id} index={index}>
                      {(provided, snapshot) => {
                        // const style = {
                        //   marginBottom: snapshot.isDragging ? 0 : 10,
                        //   ...provided.draggableProps.style,
                        // };
                        return (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={
                              snapshot.isDragging ? "" : "liSpaceDragging"
                            }
                          >
                            <ListItemCardContainer
                              {...BaseCardContainerProps}
                              displayOptions={displayOptions}
                              id={id}
                              index={index}
                              isEditMode={isEditMode}
                              itemGetter={itemGetter}
                            />
                          </li>
                        );
                      }}
                    </Draggable>
                  );
                })}
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="placeholderDiv"
                >
                  {provided.placeholder}
                </div>
              </ol>
            )}
          </Droppable>
        )}
        {onChange === undefined ? null : displayOptions.inlineConnect &&
          showConnectItems ? (
          <EditCardContainer
            {...BaseCardContainerProps}
            client={client}
            isLoadingLazyItems={isLoadingLazyItems}
            hideConnectItemsLabel={hideConnectItemsLabel}
            isMountedRef={isMountedRef}
            setHideConnectItemsLabel={setHideConnectItemsLabel}
            setIsLoadingLazyItems={setIsLoadingLazyItems}
            setShowConnectItems={setShowConnectItems}
          />
        ) : value.itemBeingCreated ? (
          <CardContainer mode="create">
            <InlineCreate
              selectedFields={selectedFields}
              fields={displayOptions.inlineCreate!.fields}
              list={foreignList}
              onCancel={() => {
                onChange({ ...value, itemBeingCreated: false });
              }}
              onCreate={(itemGetter) => {
                const id = itemGetter.data.id;
                setItems({ ...items, [id]: itemGetter });
                onChange({
                  ...value,
                  itemBeingCreated: false,
                  currentIds: field.many
                    ? new Set([...value.currentIds, id])
                    : new Set([id]),
                });
              }}
            />
          </CardContainer>
        ) : displayOptions.inlineCreate || displayOptions.inlineConnect ? (
          <CardContainer mode="create">
            <Stack gap="small" across>
              {displayOptions.inlineCreate && (
                <Button
                  size="small"
                  disabled={onChange === undefined}
                  tone="positive"
                  onClick={() => {
                    onChange({
                      ...value,
                      itemBeingCreated: true,
                    });
                  }}
                >
                  Create {foreignList.singular}
                </Button>
              )}
              {displayOptions.inlineConnect && (
                <Button
                  size="small"
                  weight="none"
                  tone="passive"
                  onClick={() => {
                    setShowConnectItems(true);
                    setHideConnectItemsLabel("Cancel");
                  }}
                >
                  Link existing {foreignList.singular}
                </Button>
              )}
            </Stack>
          </CardContainer>
        ) : null}
        {/* TODO: this may not be visible to the user when they invoke the save action. Maybe scroll to it? */}
        {forceValidation && (
          <Text color="red600" size="small">
            You must finish creating and editing any related{" "}
            {foreignList.label.toLowerCase()} before saving the{" "}
            {localList.singular.toLowerCase()}
          </Text>
        )}
      </Stack>
    </DragDropContext>
  );
}