type Tile = {
  text: string;
};

type TiledItemsProps = {
  items: Tile[];
  onSelect: (item: Tile) => void;
  className?: string;
};

const TiledItems: React.FC<TiledItemsProps> = ({ className, items, onSelect }) => {
  return (
    <div className={`${className ?? ''} grid grid-cols-6 mx-0 mt-12 md:pt-12 md:mx-24 lg:mx-32`}>
      {items.map((tile, i) => (
        <div
          key={i}
          className="col-span-6 lg:col-span-2 px-6 md:px-12 py-6 xl:p-16 lg:h-96 bg-background border border-separate"
        >
          <h1
            className="text-2xl lg:text-4xl font-semibold cursor-pointer"
            role="button"
            onClick={() => onSelect(tile)}
          >
            {tile.text}
          </h1>
        </div>
      ))}
    </div>
  );
};

export { type Tile, TiledItems };
