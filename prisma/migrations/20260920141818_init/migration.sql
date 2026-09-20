-- CreateTable
CREATE TABLE "ReadingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TO_READ',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ReadingItemToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ReadingItemToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "ReadingItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ReadingItemToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_ReadingItemToTag_AB_unique" ON "_ReadingItemToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ReadingItemToTag_B_index" ON "_ReadingItemToTag"("B");
