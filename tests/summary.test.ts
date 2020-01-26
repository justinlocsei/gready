import assert from './helpers/assert';
import { createBookshelf } from './helpers/factories';
import { SectionID, summarizeBookshelf } from '../src/summary';

describe('summary', function() {

  describe('summarizeBookshelf', function() {

    it('produces a summary of a bookshelf', function() {
      const bookshelf = createBookshelf([
        {
          author: { id: 'Author1', name: 'Alfa Bravo' },
          id: 'Book1',
          publisher: 'Publisher Alfa',
          shelves: [
            { count: 1, name: 'shelf-alfa' },
            { count: 2, name: 'shelf-bravo' }
          ],
          title: 'Book Alfa'
        },
        {
          author: { id: 'Author2', name: 'Charlie Delta' },
          id: 'Book2',
          publisher: 'Publisher Bravo',
          shelves: [{ count: 1, name: 'shelf-alfa' }],
          title: 'Book Bravo'
        }
      ], 0);

      const summary = summarizeBookshelf(bookshelf);
      const sections = summary.map(s => s.split('\n'));

      assert.deepEqual(sections, [
        [
          'Books by Author',
          '===============',
          '',
          '* Bravo, Alfa (ID=Author1)',
          '  - Book Alfa (ID=Book1)',
          '',
          '* Delta, Charlie (ID=Author2)',
          '  - Book Bravo (ID=Book2)'
        ],
        [
          'Books by Publisher',
          '==================',
          '',
          '* Publisher Alfa',
          '  - Book Alfa',
          '',
          '* Publisher Bravo',
          '  - Book Bravo'
        ],
        [
          'All Publishers',
          '==============',
          '',
          '* Publisher Alfa (1)',
          '* Publisher Bravo (1)'
        ],
        [
          'Popular Shelves',
          '===============',
          '',
          '* shelf-alfa | p100',
          '  - p100 | Book Bravo',
          '  - p50  | Book Alfa',
          '',
          '* shelf-bravo | p50',
          '  - p100 | Book Alfa'
        ],
        [
          'All Shelves',
          '===========',
          '',
          '* p100 | shelf-alfa',
          '* p50  | shelf-bravo'
        ]
      ]);
    });

    it('can summarize an empty bookshelf', function() {
      const summary = summarizeBookshelf(createBookshelf());
      assert.equal(summary.length, 5);

      const text = summary.join('\n');
      assert.include(text, 'Books by Author');
      assert.include(text, 'All Shelves');
    });

    it('supports filtering sections', function() {
      const bookshelf = createBookshelf();

      const authors = summarizeBookshelf(bookshelf, { sections: ['books-by-author'] });
      const authorsAndShelves = summarizeBookshelf(bookshelf, { sections: ['books-by-author', 'shelves'] });

      assert.equal(authors.length, 1);
      assert.equal(authorsAndShelves.length, 2);
    });

    it('maps each section ID to a unique section', function() {
      const bookshelf = createBookshelf();

      const sections: Record<SectionID, string> = {
        'books-by-author': 'Books by Author',
        'books-by-publisher': 'Books by Publisher',
        'popular-shelves': 'Popular Shelves',
        'publishers': 'All Publishers',
        'shelves': 'All Shelves'
      };

      for (const [section, title] of Object.entries(sections)) {
        const summary = summarizeBookshelf(bookshelf, { sections: [section as SectionID] });

        assert.equal(summary.length, 1);
        assert.equal(summary[0].split('\n')[0], title);
      }
    });

  });

});
